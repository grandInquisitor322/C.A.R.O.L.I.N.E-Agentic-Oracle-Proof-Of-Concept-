// client/src/components/CoinDashboard.tsx
import { useChainDataStore } from '../store/ChainDataStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function CoinDashboard() {
  const { chainData, selectedChain } = useChainDataStore();

  // Adapt this to your actual data shape (e.g., if chainData has history array)
  const chartData = chainData?.history || chainData?.priceHistory || []; // fallback

  if (!chainData) return <p className="text-gray-400">No data loaded yet</p>;

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-cyan-300">
          {selectedChain.toUpperCase()} Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-sm text-gray-400">Current Price</p>
            <p className="text-2xl font-bold">${chainData.price?.toFixed(6) || 'N/A'}</p>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-sm text-gray-400">Hashrate</p>
            <p className="text-2xl font-bold">{chainData.hashRate || 'N/A'} MH/s</p>
          </div>
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-sm text-gray-400">Latest Block</p>
            <p className="text-2xl font-bold">{chainData.latestBlock?.height || 'N/A'}</p>
          </div>
        </div>

        {/* Simple Recharts example */}
        {chartData.length > 0 && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="timestamp" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '6px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                />
                <Line type="monotone" dataKey="price" stroke="#06B6D4" strokeWidth={2} dot={false} />
                {/* Add another line if you have hashrate history */}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}