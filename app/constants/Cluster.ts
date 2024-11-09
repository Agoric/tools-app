export const CLUSTERS_MAPPING: {
  [key: string]: {
    name: string;
    namespaces: { [key: string]: string };
  };
} = {
  devnet: {
    name: 'devnet',
    namespaces: {
      instagoric: 'instagoric',
    },
  },
  emerynet: {
    name: 'emerynet',
    namespaces: {
      instagoric: 'instagoric',
    },
  },
  ollinet: {
    name: 'ollinet',
    namespaces: {
      instagoric: 'instagoric',
    },
  },
  puffynet: {
    name: 'puffynet',
    namespaces: {
      followmain: 'followmain',
    },
  },
};
