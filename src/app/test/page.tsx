export default function TestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-green-600 mb-4">
          ✅ Next.js is Running!
        </h1>
        <p className="text-gray-600">
          If you can see this page, Next.js and Tailwind CSS are working properly.
        </p>
        <div className="mt-4 p-4 bg-blue-50 rounded">
          <p className="text-sm text-blue-800">
            Visit <code className="bg-blue-200 px-2 py-1 rounded">/test</code> to view this test page
          </p>
        </div>
      </div>
    </div>
  )
}
