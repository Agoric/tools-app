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
import { client as DatabaseClient } from 'api/client/database';
import { ReadableOptions } from 'stream';

type LogEntry = {
  id: number;
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

const COMMIT_BLOCK_FINISH_EVENT_TYPE = 'cosmic-swingset-commit-block-finish';
const POD_FILTER = `"resourceLabels" @@ '$.pod_name == "follower-0"' OR "resourceLabels" @@ '$.pod_name == "fork1-0"' OR "resourceLabels" @@ '$.pod_name == "validator-primary-0"'`;
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

const fetchLogsBetween = async (body: LogsRequestBody) => {
  const { fd, name } = fileSync({
    postfix: '.log',
    prefix: 'logs-',
  });

  const writeStream = createWriteStream(null as unknown as PathLike, { fd });

  let pageOffset = 0;
  const pageSize = 1000;

  while (true) {
    console.log(
      `Fetching logs between ${body.startTime} to ${body.endTime} with offset ${pageOffset} and page size ${pageSize}`,
    );

    const data = await queryLog(body, pageOffset, pageSize);
    pageOffset += pageSize;

    if (data.length)
      for (const entry of data) {
        const { id: _, ...log } = entry;
        const canWrite = writeStream.write(JSON.stringify(log) + '\n');
        if (!canWrite)
          await new Promise((resolve) => writeStream.once('drain', resolve));
      }
    else break;
  }

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
  body: LogsRequestBody,
  pageOffset: number = 0,
  pageSize: number = 1000,
) => {
  const { rows } = await DatabaseClient.pool.query<LogEntry>(`
    SELECT *
    FROM slogs
    WHERE (
      "resourceLabels" @@ '$.cluster_name == "${body.clusterName}"'
      AND "resourceLabels" @@ '$.namespace_name == "${body.namespace}"'
      AND (${POD_FILTER})
      AND "timestamp" >= '${body.startTime}'
      AND "timestamp" <= '${body.endTime}'
    )
    ORDER BY "timestamp" ASC
    LIMIT ${pageSize}
    OFFSET ${pageOffset}
  `);

  return rows;
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

    const fileName = await fetchLogsBetween(body);

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
        body.endBlockHeight >= body.startBlockHeight
      )
    )
      return NextResponse.json({ message: 'Invalid Form' }, { status: 400 });

    const { rows: startBlockRows } = await DatabaseClient.pool.query<LogEntry>(`
      SELECT timestamp
      FROM slogs
      WHERE (
        "jsonPayload" @@ '$.blockHeight == ${body.startBlockHeight}'
        AND "jsonPayload" @@ '$.type == "${START_BLOCK_EVENT_TYPE}"'
        AND "resourceLabels" @@ '$.cluster_name == "${body.clusterName}"'
        AND "resourceLabels" @@ '$.namespace_name == "${body.namespace}"'
        AND (${POD_FILTER})
      )
    `);

    if (!startBlockRows.length)
      return NextResponse.json(
        { message: 'Start time search exhausted' },
        { status: 404 },
      );

    const { rows: endBlockRows } = await DatabaseClient.pool.query<LogEntry>(`
      SELECT timestamp
      FROM slogs
      WHERE (
        "jsonPayload" @@ '$.blockHeight == ${body.endBlockHeight}'
        AND "jsonPayload" @@ '$.type == "${COMMIT_BLOCK_FINISH_EVENT_TYPE}"'
        AND "resourceLabels" @@ '$.cluster_name == "${body.clusterName}"'
        AND "resourceLabels" @@ '$.namespace_name == "${body.namespace}"'
        AND (${POD_FILTER})
      )
    `);

    if (!endBlockRows.length)
      return NextResponse.json(
        { message: 'End time search exhausted' },
        { status: 404 },
      );

    const beginBlockTimestamp = startBlockRows.find(Boolean)?.timestamp;
    const endBlockTimestamp = endBlockRows.find(Boolean)?.timestamp;

    return NextResponse.json({
      endTime: endBlockTimestamp,
      startTime: beginBlockTimestamp,
    });
  } catch (err) {
    return NextResponse.json({ message: String(err) }, { status: 500 });
  }
};
