import {
  createReadStream,
  createWriteStream,
  PathLike,
  statSync,
  unlink,
} from 'fs';
import { basename } from 'path';
import {
  NextRequest,
  NextResponse,
  unstable_after as after,
} from 'next/server';
import { fileSync } from 'tmp';
import { getAccessToken, serviceAccount } from 'api/utils';
import { ReadableOptions } from 'stream';

type LogEntry = {
  insertId: string;
  jsonPayload: {
    blockHeight: number;
    blockTime: number;
    monotime: number;
    type: typeof COMMIT_BLOCK_FINISH_EVENT_TYPE;
  };
  labels: {
    'compute.googleapis.com/resource_name': string;
    'k8s-pod/app': string;
    'k8s-pod/apps_kubernetes_io/pod-index': string;
    'k8s-pod/controller-revision-hash': string;
    'k8s-pod/grouplb': string;
    'k8s-pod/statefulset_kubernetes_io/pod-name': string;
  };
  logName: string;
  receiveTimestamp: string;
  resource: {
    labels: {
      cluster_name: string;
      container_name: string;
      location: string;
      namespace_name: string;
      pod_name: string;
      project_id: string;
    };
    type: string;
  };
  severity: string;
  timestamp: string;
};

const CHUNK_SIZE = 6 * 60 * 60 * 1000; // 6 hours or 21600000 ms
const COMMIT_BLOCK_FINISH_EVENT_TYPE = 'cosmic-swingset-commit-block-finish';
const LOG_ENTRIES_ENDPOINT = 'https://logging.googleapis.com/v2/entries:list';
const MAXIMUM_DAYS = 30;
const MILLI_SECONDS_PER_DAY = 24 * 60 * 60 * 1000; // 86400000 ms
const START_BLOCK_EVENT_TYPE = 'cosmic-swingset-begin-block';

type RequestContext = {
  clusterName: string;
  namespace: string;
};

type LogsRequestBody = RequestContext & {
  endTime: string;
  startTime: string;
};

type TimestampsRequestBody = RequestContext & {
  endBlockHeight: number;
  startBlockHeight: number;
};

const ADDITIONAL_FILTERS = `
resource.labels.container_name="log-slog"
resource.labels.pod_name=("fork1-0" OR "follower-0" OR "validator-primary-0")
resource.type="k8s_container"
`;

const fetchLogsBetween = async (
  accessToken: Awaited<ReturnType<typeof getAccessToken>>,
  body: LogsRequestBody,
) => {
  const filter = `
resource.labels.cluster_name="${body.clusterName}"
resource.labels.namespace_name="${body.namespace}"
    `;

  const { fd, name } = fileSync({
    postfix: '.log',
    prefix: 'logs-',
  });

  const writeStream = createWriteStream(null as unknown as PathLike, { fd });

  let pageToken = undefined;

  console.log(`Fetching logs between ${body.startTime} to ${body.endTime}`);

  do {
    const data = await queryLog(
      accessToken,
      body.endTime,
      body.startTime,
      filter,
      undefined,
      pageToken,
    );

    if (data.entries) {
      for (const entry of data.entries) {
        const canWrite = writeStream.write(JSON.stringify(entry) + '\n');
        if (!canWrite)
          await new Promise((resolve) => writeStream.once('drain', resolve));
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return new Promise<typeof name>((resolve, reject) => {
    let closed: boolean;
    let finished: boolean;

    writeStream.close((err) =>
      err ? reject(err) : finished ? resolve(name) : (closed = true),
    );
    writeStream.on('finish', () =>
      closed ? resolve(name) : (finished = true),
    );
  });
};

const queryLog = async (
  accessToken: string,
  endTime: string,
  startTime: string,
  filter: string = '',
  pageSize: number | undefined = undefined,
  pageToken: string | undefined = undefined,
) => {
  const fullFilter = `
${ADDITIONAL_FILTERS}
${filter}
timestamp >= "${startTime}" AND timestamp <= "${endTime}"
  `;

  const body = {
    filter: fullFilter,
    orderBy: 'timestamp asc',
    pageSize,
    pageToken,
    resourceNames: ['projects/' + serviceAccount.project_id],
  };

  const response = await fetch(LOG_ENTRIES_ENDPOINT, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok)
    if (response.status === 429) {
      console.log('Hit quota limit, backing off for 10 seconds');
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return queryLog(
        accessToken,
        endTime,
        startTime,
        filter,
        pageSize,
        pageToken,
      );
    } else
      throw Error(
        `Failed to query logs due to error: ${await response.text()}`,
      );

  return (await response.json()) as {
    entries: Array<LogEntry>;
    nextPageToken?: string;
  };
};

const searchForLogEntry = async ({
  accessToken,
  filter,
  searchForward,
  startTime,
}: {
  accessToken: Awaited<ReturnType<typeof getAccessToken>>;
  filter: string;
  searchForward?: boolean;
  startTime?: Date;
}) => {
  const nowDate = new Date();
  const startDate = startTime || nowDate;

  for (
    let offset = 0;
    offset <
    (searchForward
      ? nowDate.getTime() - startDate.getTime()
      : MAXIMUM_DAYS * MILLI_SECONDS_PER_DAY);
    offset += CHUNK_SIZE
  ) {
    const endTime = new Date(
      searchForward
        ? startDate.getTime() + offset + CHUNK_SIZE
        : startDate.getTime() - offset,
    ).toISOString();
    const startTime = new Date(
      searchForward
        ? startDate.getTime() + offset
        : startDate.getTime() - offset - CHUNK_SIZE,
    ).toISOString();

    console.log(`Searching log entry between ${startTime} and ${endTime}`);

    const response = await queryLog(accessToken, endTime, startTime, filter, 1);

    if (response.entries?.length) return response.entries.find(Boolean) || null;
  }

  return null;
};

const streamFile = (
  path: string,
  options?: ReadableOptions,
): ReadableStream<Uint8Array> => {
  const downloadStream = createReadStream(path, options);

  return new ReadableStream({
    start: (controller) => {
      downloadStream.on('data', (chunk: Buffer) =>
        controller.enqueue(new Uint8Array(chunk)),
      );
      downloadStream.on('end', () => controller.close());
      downloadStream.on('error', (error: NodeJS.ErrnoException) => {
        console.error('Stream error: ', error);
        controller.error(error);
      });
    },
    cancel: (reason) => {
      console.warn('Stream cancelled because: ', reason);
      downloadStream.destroy();
    },
  });
};

export const GET = async (request: NextRequest) => {
  try {
    const body = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    ) as unknown as LogsRequestBody;

    if (!(body.clusterName && body.endTime && body.namespace && body.startTime))
      return NextResponse.json({ message: 'Invalid Form' }, { status: 400 });

    const accessToken = await getAccessToken();

    const fileName = await fetchLogsBetween(accessToken, body);

    const data = streamFile(fileName);

    after(() =>
      unlink(
        fileName,
        (err) => err && console.error(`Error removing file ${fileName}: `, err),
      ),
    );

    return new NextResponse(data, {
      headers: new Headers({
        'Content-Disposition': `attachment; filename=${basename(fileName)}`,
        'Content-Length': String(statSync(fileName).size),
        'Content-Type': 'text/plain',
      }),
      status: 200,
    });
  } catch (err) {
    return NextResponse.json({ message: String(err) }, { status: 500 });
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const body: TimestampsRequestBody = await request.json();

    if (
      !(
        body.clusterName &&
        body.namespace &&
        body.startBlockHeight &&
        (!body.endBlockHeight || body.endBlockHeight >= body.startBlockHeight)
      )
    )
      return NextResponse.json({ message: 'Invalid Form' }, { status: 400 });

    const accessToken = await getAccessToken();

    const beginBlockFilter = `
jsonPayload.blockHeight=${body.startBlockHeight}
jsonPayload.type="${START_BLOCK_EVENT_TYPE}"
resource.labels.cluster_name="${body.clusterName}"
resource.labels.namespace_name="${body.namespace}"
    `;
    const commitBlockFinishFilter = `
jsonPayload.blockHeight=${body.endBlockHeight}
jsonPayload.type="${COMMIT_BLOCK_FINISH_EVENT_TYPE}"
resource.labels.cluster_name="${body.clusterName}"
resource.labels.namespace_name="${body.namespace}"
    `;

    const foundBeginBlock = await searchForLogEntry({
      accessToken,
      filter: beginBlockFilter,
    });

    if (!foundBeginBlock)
      return NextResponse.json(
        { message: 'Start time search exhausted' },
        { status: 404 },
      );

    const foundCommitBlockFinish = await searchForLogEntry({
      accessToken,
      filter: commitBlockFinishFilter,
      searchForward: true,
      startTime: new Date(foundBeginBlock.timestamp),
    });

    if (!foundCommitBlockFinish)
      return NextResponse.json(
        { message: 'End time search exhausted' },
        { status: 404 },
      );

    return NextResponse.json({
      endTime: foundCommitBlockFinish.timestamp,
      startTime: foundBeginBlock.timestamp,
    });
  } catch (err) {
    return NextResponse.json({ message: String(err) }, { status: 500 });
  }
};
