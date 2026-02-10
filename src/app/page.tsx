'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
          🏦 NestWallet
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Enterprise Blockchain Wallet System
        </p>
        
        <div className="space-y-4">
          <Link 
            href="/auth/login"
            className="block w-full bg-blue-600 text-white text-center py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Login
          </Link>
          
          <Link 
            href="/auth/register"
            className="block w-full bg-gray-200 text-gray-800 text-center py-3 rounded-lg hover:bg-gray-300 transition"
          >
            Register New Account
          </Link>
        </div>

        <div className="mt-8 p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-green-800 text-center">
            ✅ Next.js + Tailwind CSS Running Normally
          </p>
        </div>
      </div>
    </div>
  )
}
