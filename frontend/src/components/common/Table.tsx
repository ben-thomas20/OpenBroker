import { ReactNode } from 'react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
}

export function Table<T extends Record<string, any>>({ 
  columns, 
  data, 
  loading = false,
  emptyMessage = 'No data available' 
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-700">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={index}
              className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
            >
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className="px-6 py-4 text-sm text-gray-300"
                >
                  {column.render
                    ? column.render(item)
                    : String(item[column.key as keyof T] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

