import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { 
  NOTION_DATABASE_ID,
  queryDatabaseEntries,
  createDatabaseEntry
} from '@/lib/notion'

// GET /api/notion/sync - Check sync status
export async function GET() {
  try {
    // Get local content count
    const localCount = await db.content.count()
    
    // Get content already synced to Notion
    const syncedContent = await db.content.findMany({
      where: { notionPageId: { not: null } }
    })
    
    // Get entries in Notion database
    const notionEntries = await queryDatabaseEntries()
    
    const syncedCount = syncedContent.length
    const pendingSync = localCount - syncedCount

    return NextResponse.json({
      success: true,
      connected: !!NOTION_DATABASE_ID,
      databaseId: NOTION_DATABASE_ID,
      data: {
        localContent: localCount,
        syncedContent: syncedCount,
        pendingSync,
        notionEntries: notionEntries.length,
        syncedItems: syncedContent.map(c => ({
          id: c.id,
          title: c.title,
          notionPageId: c.notionPageId
        }))
      }
    })
  } catch (error: any) {
    console.error('Sync status error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/notion/sync - Push content to Notion
export async function POST(request: NextRequest) {
  try {
    if (!NOTION_DATABASE_ID) {
      return NextResponse.json(
        { success: false, error: 'NOTION_DATABASE_ID not configured' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { contentId, syncAll } = body

    const statusMap: Record<string, string> = {
      'DRAFT': 'Draft',
      'READY_TO_PUBLISH': 'Ready to Publish',
      'PUBLISHED': 'Published',
      'ARCHIVED': 'Archived'
    }

    let pushed = 0
    let errors: string[] = []
    const syncedItems: { title: string; notionUrl: string }[] = []

    if (contentId) {
      // Push single content
      const content = await db.content.findUnique({
        where: { id: contentId }
      })

      if (!content) {
        return NextResponse.json(
          { success: false, error: 'Content not found' },
          { status: 404 }
        )
      }

      try {
        const page = await createDatabaseEntry(
          content.title,
          content.body,
          {
            type: content.type as 'Note' | 'Post',
            status: statusMap[content.status] || 'Draft',
            tags: content.tags?.split(',').map(t => t.trim()).filter(Boolean) || [],
            wordCount: content.wordCount,
            substackLink: content.substackLink || undefined
          }
        )

        // Update local with Notion page ID
        await db.content.update({
          where: { id: contentId },
          data: { notionPageId: page.id }
        })
        
        pushed = 1
        syncedItems.push({ title: content.title, notionUrl: page.url })
      } catch (err: any) {
        errors.push(`${content.title}: ${err.message}`)
      }
    } else if (syncAll) {
      // Push all unsynced content
      const contents = await db.content.findMany({
        where: { notionPageId: null }
      })

      for (const content of contents) {
        try {
          const page = await createDatabaseEntry(
            content.title,
            content.body,
            {
              type: content.type as 'Note' | 'Post',
              status: statusMap[content.status] || 'Draft',
              tags: content.tags?.split(',').map(t => t.trim()).filter(Boolean) || [],
              wordCount: content.wordCount,
              substackLink: content.substackLink || undefined
            }
          )

          await db.content.update({
            where: { id: content.id },
            data: { notionPageId: page.id }
          })
          
          pushed++
          syncedItems.push({ title: content.title, notionUrl: page.url })
        } catch (err: any) {
          errors.push(`${content.title}: ${err.message}`)
        }
      }
    }

    return NextResponse.json({
      success: pushed > 0,
      message: `Pushed ${pushed} item(s) to Notion`,
      data: {
        pushed,
        syncedItems,
        errors: errors.length > 0 ? errors : undefined
      }
    })
  } catch (error: any) {
    console.error('Push error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
