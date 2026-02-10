import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Get user login history
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get login history from SIEM events
    const loginHistory = await prisma.$queryRaw`
      SELECT 
        id,
        event_type as eventType,
        ip_address as ipAddress,
        user_agent as userAgent,
        event_data as eventData,
        created_at as createdAt,
        risk_level as riskLevel
      FROM siem_events 
      WHERE user_id = ${user.id} 
        AND event_type IN ('LOGIN', 'LOGIN_FAILED', 'LOGOUT')
      ORDER BY created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    ` as any[]

    // Parse event data
    const parsedHistory = loginHistory.map(event => {
      let eventData = {}
      try {
        eventData = JSON.parse(event.eventData || '{}')
      } catch (e) {
        // Ignore parse errors
      }

      return {
        id: event.id,
        type: event.eventType,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        location: getLocationFromIP(event.ipAddress),
        device: parseUserAgent(event.userAgent),
        successful: event.eventType === 'LOGIN' || event.eventType === 'LOGOUT',
        riskLevel: event.riskLevel,
        timestamp: event.createdAt,
        details: eventData
      }
    })

    // Get total count
    const totalResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM siem_events 
      WHERE user_id = ${user.id} 
        AND event_type IN ('LOGIN', 'LOGIN_FAILED', 'LOGOUT')
    ` as any[]
    
    const total = totalResult[0]?.count || 0

    return NextResponse.json({
      successful: true,
      history: parsedHistory,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    console.error('get login historyfailed:', error)
    return NextResponse.json({ error: 'Failed to get login history' }, { status: 500 })
  }
}

// Simple IP address location parsing (simulated)
function getLocationFromIP(ip: string): string {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === 'localhost') {
    return 'Local'
  }
  
  // Real IP geolocation service can be integrated here
  const mockLocations = [
    'Beijing',
    'Shanghai', 
    'Guangzhou',
    'Shenzhen',
    'Hangzhou',
    'Chengdu'
  ]
  
  // Simple hash based on IP to choose location
  const hash = ip.split('.').reduce((acc, part) => acc + parseInt(part), 0)
  return mockLocations[hash % mockLocations.length]
}

// Parse User-Agent to get device info
function parseUserAgent(userAgent: string): {
  browser: string
  os: string
  device: string
} {
  if (!userAgent) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' }
  }

  let browser = 'Unknown'
  let os = 'Unknown'
  let device = 'Desktop'

  // Detect browser
  if (userAgent.includes('Chrome')) browser = 'Chrome'
  else if (userAgent.includes('Firefox')) browser = 'Firefox'
  else if (userAgent.includes('Safari')) browser = 'Safari'
  else if (userAgent.includes('Edge')) browser = 'Edge'

  // Detect operating system
  if (userAgent.includes('Windows')) os = 'Windows'
  else if (userAgent.includes('Mac')) os = 'macOS'
  else if (userAgent.includes('Linux')) os = 'Linux'
  else if (userAgent.includes('Android')) os = 'Android'
  else if (userAgent.includes('iOS')) os = 'iOS'

  // Detect device type
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) device = 'Mobile'
  else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) device = 'Tablet'

  return { browser, os, device }
}
