export default function TestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-green-600 mb-4">
          ✅ Next.js 正常运行！
        </h1>
        <p className="text-gray-600">
          如果你能看到这个页面，说明Next.js和Tailwind CSS都工作正常。
        </p>
        <div className="mt-4 p-4 bg-blue-50 rounded">
          <p className="text-sm text-blue-800">
            访问 <code className="bg-blue-200 px-2 py-1 rounded">/test</code> 查看此测试页
          </p>
        </div>
      </div>
    </div>
  )
}
