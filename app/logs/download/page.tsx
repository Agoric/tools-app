'use client';

import { useContext, useState } from 'react';
import TextInput from 'components/TextInput';
import { Context as ClusterContext } from 'context/Cluster';
import { Context as NamespaceContext } from 'context/Namespace';

type State = {
  endBlockHeight: string;
  inProgress: boolean;
  message: string;
  startBlockHeight: string;
};

const ERROR_PREFIX = '[ERROR]';

const Page = () => {
  const { clusterName } = useContext(ClusterContext);
  const { namespace } = useContext(NamespaceContext);

  const [state, setState] = useState<State>({
    endBlockHeight: '',
    inProgress: false,
    message: '',
    startBlockHeight: '',
  });

  const fetchTimestamps = async () => {
    try {
      const startBlockHeight = Number(state.startBlockHeight);
      const endBlockHeight = Number(state.endBlockHeight) || startBlockHeight;

      setState((prevState) => ({
        ...prevState,
        inProgress: true,
        message: `Fetching timestamps between block ${endBlockHeight} to block ${state.startBlockHeight}`,
      }));

      const timestampsResponse = await fetch('/api/logs/block-height', {
        body: JSON.stringify({
          clusterName,
          endBlockHeight,
          namespace,
          startBlockHeight,
        }),
        method: 'POST',
      });

      const data = (await timestampsResponse.json()) as {
        endTime: string;
        startTime: string;
      };

      const downloadUrl = new URL(
        '/api/logs/block-height',
        window.location.origin,
      );

      downloadUrl.searchParams.set('clusterName', clusterName);
      downloadUrl.searchParams.set('endTime', data.endTime);
      downloadUrl.searchParams.set('namespace', namespace);
      downloadUrl.searchParams.set('startTime', data.startTime);

      window.open(downloadUrl.toString(), '_blank', 'noopener');

      setState((prevState) => ({
        ...prevState,
        inProgress: false,
        message: '',
      }));
    } catch (err) {
      setState((prevState) => ({
        ...prevState,
        error: 'Unexpected error occured. Please try again after some time',
        inProgress: false,
        message: `${ERROR_PREFIX} Unexpected error occured. Please try again after some time`,
      }));
    }
  };

  const validInputs =
    !!Number(state.startBlockHeight) &&
    (!Number(state.endBlockHeight) ||
      Number(state.endBlockHeight) >= Number(state.startBlockHeight));

  return (
    <div className="flex flex-col h-full items-start p-4 space-y-4 w-full">
      {state.message && (
        <p
          className={`m-0 text-center w-full ${state.message.startsWith(ERROR_PREFIX) ? 'text-red' : ''}`}
        >
          {state.message}
        </p>
      )}

      <div className="flex space-x-4 w-full">
        <div className="flex flex-col space-y-1 w-full">
          <label>Start Block Height</label>
          <TextInput
            className="border border-solid border-gray w-full"
            onChange={({ target: { value } }) =>
              !isNaN(Number(value)) &&
              setState((prevState) => ({
                ...prevState,
                startBlockHeight: value,
              }))
            }
            value={state.startBlockHeight}
          />
        </div>

        <div className="flex flex-col space-y-1 w-full">
          <label>End Block Height</label>
          <TextInput
            className="border border-solid border-gray w-full"
            onChange={({ target: { value } }) =>
              !isNaN(Number(value)) &&
              setState((prevState) => ({ ...prevState, endBlockHeight: value }))
            }
            value={state.endBlockHeight}
          />
        </div>
      </div>

      <button
        className="border border-solid border-black disabled:pointer-events-none disabled:text-gray px-2 py-1 text-center"
        disabled={state.inProgress || !validInputs}
        onClick={fetchTimestamps}
      >
        Fetch Logs
      </button>
    </div>
  );
};

export default Page;
