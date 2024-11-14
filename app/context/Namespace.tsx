import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { CLUSTERS_MAPPING } from 'constants/Cluster';
import { Context as ClusterContext } from 'context/Cluster';

type ContextType = State & {
  setNamespace: (_: State['namespace']) => void;
};

type State = {
  namespace: string;
};

const defaultState: State = {
  namespace: CLUSTERS_MAPPING.puffynet.namespaces.FOLLOW_MAIN,
};

const defaultValue: ContextType = {
  ...defaultState,
  setNamespace: () => {},
};

export const Context = createContext<ContextType>(defaultValue);

const Provider = ({ children }: { children: ReactNode }) => {
  const { clusterName } = useContext(ClusterContext);
  const [state, setState] = useState<State>(defaultState);

  const setNamespace = useCallback(
    (namespace: State['namespace']) =>
      Object.values(CLUSTERS_MAPPING[clusterName].namespaces).includes(
        namespace,
      ) &&
      setState((prevState) => ({
        ...prevState,
        namespace,
      })),
    [],
  );

  useEffect(() => {
    setState((prevState) => ({
      ...prevState,
      namespace: String(
        Object.values(CLUSTERS_MAPPING[clusterName].namespaces).find(Boolean),
      ),
    }));
  }, [clusterName]);

  return (
    <Context.Provider value={{ ...state, setNamespace }}>
      {children}
    </Context.Provider>
  );
};

export default Provider;
