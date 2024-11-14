import { createContext, ReactNode, useCallback, useState } from 'react';
import { CLUSTERS_MAPPING } from 'constants/Cluster';

type ContextType = State & {
  setClusterName: (_: State['clusterName']) => void;
};

type State = {
  clusterName: string;
};

const defaultState: State = {
  clusterName: CLUSTERS_MAPPING.puffynet.name,
};

const defaultValue: ContextType = {
  ...defaultState,
  setClusterName: () => {},
};

export const Context = createContext<ContextType>(defaultValue);

const Provider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<State>(defaultState);

  const setClusterName = useCallback(
    (clusterName: State['clusterName']) =>
      Object.values(CLUSTERS_MAPPING).map(({name}) => name).includes(clusterName) &&
      setState((prevState) => ({
        ...prevState,
        clusterName,
      })),
    [],
  );

  return (
    <Context.Provider value={{ ...state, setClusterName }}>
      {children}
    </Context.Provider>
  );
};

export default Provider;
