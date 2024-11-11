import Link from 'next/link';
import { useContext } from 'react';
import Dropdown from 'components/Dropdown';
import { CLUSTERS_MAPPING } from 'constants/Cluster';
import { Context as ClusterContext } from 'context/Cluster';
import { Context as NamespaceContext } from 'context/Namespace';
import Logo from 'icons/logo.svg';

const Header = () => {
  const { clusterName, setClusterName } = useContext(ClusterContext);
  const { namespace, setNamespace } = useContext(NamespaceContext);

  return (
    <nav className="flex justify-between items-center px-8 py-6 w-full">
      <Link href="/">
        <Logo className="h-6 text-main w-9" />
      </Link>

      <div className="flex items-center space-x-2">
        <Dropdown
          isSearchable={false}
          options={Object.entries(CLUSTERS_MAPPING).map(([label, value]) => ({
            label,
            value: value.name,
          }))}
          onChange={(newValue) =>
            setClusterName((newValue as { label: string; value: string }).value)
          }
          value={{
            label: Object.entries(CLUSTERS_MAPPING)
              .find(([, value]) => clusterName === value.name)
              ?.find(Boolean),
            value: clusterName,
          }}
        />

        <Dropdown
          isSearchable={false}
          options={Object.entries(CLUSTERS_MAPPING[clusterName].namespaces).map(
            ([label, value]) => ({
              label,
              value,
            }),
          )}
          onChange={(newValue) =>
            setNamespace((newValue as { label: string; value: string }).value)
          }
          value={{
            label: Object.entries(CLUSTERS_MAPPING[clusterName].namespaces)
              .find(([, value]) => namespace === value)
              ?.find(Boolean),
            value: namespace,
          }}
        />
      </div>
    </nav>
  );
};

export default Header;
