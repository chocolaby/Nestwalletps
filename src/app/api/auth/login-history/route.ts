import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 获取用户登录历史
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // 从SIEM事件中获取登录历史
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

    // 解析事件数据
    const parsedHistory = loginHistory.map(event => {
      let eventData = {}
      try {
        eventData = JSON.parse(event.eventData || '{}')
      } catch (e) {
        // 忽略解析错误
      }

      return {
        id: event.id,
        type: event.eventType,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        location: getLocationFromIP(event.ipAddress),
        device: parseUserAgent(event.userAgent),
        success: event.eventType === 'LOGIN' || event.eventType === 'LOGOUT',
        riskLevel: event.riskLevel,
        timestamp: event.createdAt,
        details: eventData
      }
    })

    // 获取总数
    const totalResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM siem_events 
      WHERE user_id = ${user.id} 
        AND event_type IN ('LOGIN', 'LOGIN_FAILED', 'LOGOUT')
    ` as any[]
    
    const total = totalResult[0]?.count || 0

    return NextResponse.json({
      success: true,
      history: parsedHistory,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    console.error('获取登录历史失败:', error)
    return NextResponse.json({ error: '获取登录历史失败' }, { status: 500 })
  }
}

// 简单的IP地址位置解析（模拟）
function getLocationFromIP(ip: string): string {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === 'localhost') {
    return '本地'
  }
  
  // 这里可以集成真实的IP地理位置服务
  const mockLocations = [
    '北京市',
    '上海市', 
    '广州市',
    '深圳市',
    '杭州市',
    '成都市'
  ]
  
  // 基于IP的简单哈希来选择位置
  const hash = ip.split('.').reduce((acc, part) => acc + parseInt(part), 0)
  return mockLocations[hash % mockLocations.length]
}

// 解析User-Agent获取设备信息
function parseUserAgent(userAgent: string): {
  browser: string
  os: string
  device: string
} {
  if (!userAgent) {
    return { browser: '未知', os: '未知', device: '未知' }
  }

  let browser = '未知'
  let os = '未知'
  let device = '桌面设备'

  // 检测浏览器
  if (userAgent.includes('Chrome')) browser = 'Chrome'
  else if (userAgent.includes('Firefox')) browser = 'Firefox'
  else if (userAgent.includes('Safari')) browser = 'Safari'
  else if (userAgent.includes('Edge')) browser = 'Edge'

  // 检测操作系统
  if (userAgent.includes('Windows')) os = 'Windows'
  else if (userAgent.includes('Mac')) os = 'macOS'
  else if (userAgent.includes('Linux')) os = 'Linux'
  else if (userAgent.includes('Android')) os = 'Android'
  else if (userAgent.includes('iOS')) os = 'iOS'

  // 检测设备类型
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) device = '移动设备'
  else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) device = '平板设备'

  return { browser, os, device }
}
