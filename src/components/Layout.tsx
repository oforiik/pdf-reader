'use client';

import Link from 'next/link';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md">
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-[#5d87ff]">PDF Reader</h1>
        </div>
        <nav className="mt-6">
          <Link 
            href="/" 
            className="flex items-center px-6 py-3 text-gray-600 hover:bg-gray-100"
          >
            <span className="ml-2">Home</span>
          </Link>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
};
