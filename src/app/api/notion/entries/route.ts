import { NextRequest, NextResponse } from 'next/server'
import { notion, NOTION_DATABASE_ID } from '@/lib/notion'

// GET /api/notion/entries - Get entries from the database
export async function GET(request: NextRequest) {
  const databaseId = NOTION_DATABASE_ID

  if (!databaseId) {
    return NextResponse.json({ error: 'No database ID configured' }, { status: 400 })
  }

  try {
    // Query entries
    const entries = await notion.databases.query({
      database_id: databaseId,
      page_size: 10
    })
    
    // Get database info
    const db = await notion.databases.retrieve({ database_id: databaseId })

    return NextResponse.json({
      success: true,
      data: {
        database: {
          id: db.id,
          title: (db as any).title,
          properties: (db as any).properties
        },
        entries: entries.results.map((page: any) => ({
          id: page.id,
          properties: page.properties,
          url: page.url
        })),
        total: entries.results.length
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
