'use client';

import React from 'react';
import Header from 'components/Header';
import ClusterProvider from 'context/Cluster';
import NamespaceProvider from 'context/Namespace';
import 'index.css';

const Layout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <body>
      <div className="flex h-screen w-screen">
        <ClusterProvider>
          <NamespaceProvider>
            {/* Add Sidebar here */}
            <div className="flex flex-col h-full items-center w-full">
              <Header />
              {children}
            </div>
          </NamespaceProvider>
        </ClusterProvider>
      </div>
    </body>
  </html>
);

export default Layout;
