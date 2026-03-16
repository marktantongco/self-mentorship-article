import { NextRequest, NextResponse } from 'next/server'
import { NOTION_DATABASE_ID, getDatabaseInfo, queryDatabaseEntries } from '@/lib/notion'

// GET /api/notion - Check Notion connection and database status
export async function GET() {
  try {
    if (!NOTION_DATABASE_ID) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: 'NOTION_DATABASE_ID not configured'
      })
    }

    // Get database info
    const dbInfo = await getDatabaseInfo()
    
    if (!dbInfo) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: 'Could not retrieve database'
      })
    }
    
    // Get entries count
    const entries = await queryDatabaseEntries()

    return NextResponse.json({
      success: true,
      connected: true,
      data: {
        id: dbInfo.id,
        title: (dbInfo as any).title?.[0]?.plain_text || 'Database',
        url: (dbInfo as any).url,
        entryCount: entries.length,
        properties: Object.keys((dbInfo as any).properties || {})
      }
    })
  } catch (error: any) {
    console.error('Notion API error:', error)
    return NextResponse.json({
      success: false,
      connected: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST /api/notion - Verify/create database connection
export async function POST() {
  try {
    if (!NOTION_DATABASE_ID) {
      return NextResponse.json({
        success: false,
        error: 'NOTION_DATABASE_ID not configured. Set it in environment variables.'
      }, { status: 400 })
    }

    // Get database info to verify connection
    const dbInfo = await getDatabaseInfo()
    
    if (!dbInfo) {
      return NextResponse.json({
        success: false,
        error: 'Could not access database. Check your API key and database ID.'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      created: false,
      data: {
        id: dbInfo.id,
        title: (dbInfo as any).title?.[0]?.plain_text || 'Database',
        url: (dbInfo as any).url
      }
    })
  } catch (error: any) {
    console.error('Notion POST error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
