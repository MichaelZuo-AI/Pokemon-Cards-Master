'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">📡</div>
        <h1 className="text-2xl font-bold mb-2">网络连接已断开</h1>
        <p className="text-gray-400 mb-6">
          无法连接到网络，请检查你的网络设置后重试。
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          重新加载
        </button>
      </div>
    </div>
  );
}
