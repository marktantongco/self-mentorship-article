import { NextRequest, NextResponse } from 'next/server'
import { notion, NOTION_DATABASE_ID } from '@/lib/notion'

// GET /api/notion/schema - Get database properties
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const databaseId = searchParams.get('databaseId') || NOTION_DATABASE_ID

  if (!databaseId) {
    return NextResponse.json({ error: 'databaseId required' }, { status: 400 })
  }

  try {
    const db = await notion.databases.retrieve({ database_id: databaseId })
    
    return NextResponse.json({
      success: true,
      data: {
        id: db.id,
        title: (db as any).title?.[0]?.plain_text || 'Database',
        properties: (db as any).properties,
        url: (db as any).url
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
