import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ContentStatus, ContentType } from '@prisma/client'

// GET /api/pipeline - Get pipeline stats and queue
export async function GET() {
  try {
    const [stats, queue, recent] = await Promise.all([
      // Get counts by status
      db.content.groupBy({
        by: ['status'],
        _count: { id: true }
      }),
      // Get ready to publish items
      db.content.findMany({
        where: { status: ContentStatus.READY_TO_PUBLISH },
        orderBy: { createdAt: 'asc' },
        take: 10
      }),
      // Get recent published
      db.content.findMany({
        where: { status: ContentStatus.PUBLISHED },
        orderBy: { publishedAt: 'desc' },
        take: 5
      })
    ])
    
    const statusCounts = stats.reduce((acc, s) => {
      acc[s.status] = s._count.id
      return acc
    }, {} as Record<string, number>)
    
    return NextResponse.json({
      success: true,
      data: {
        stats: {
          draft: statusCounts.DRAFT || 0,
          readyToPublish: statusCounts.READY_TO_PUBLISH || 0,
          published: statusCounts.PUBLISHED || 0,
          archived: statusCounts.ARCHIVED || 0
        },
        queue,
        recentPublished: recent
      }
    })
  } catch (error) {
    console.error('Error fetching pipeline:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pipeline' },
      { status: 500 }
    )
  }
}

// POST /api/pipeline - Process content (publish, email, etc.)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, contentId } = body
    
    const content = await db.content.findUnique({
      where: { id: contentId }
    })
    
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Content not found' },
        { status: 404 }
      )
    }
    
    switch (action) {
      case 'publish': {
        // Simulate publishing to Substack
        const substackLink = `https://markytanky.substack.com/p/${content.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')}`
        
        const updated = await db.content.update({
          where: { id: contentId },
          data: {
            status: ContentStatus.PUBLISHED,
            publishedAt: new Date(),
            substackLink
          }
        })
        
        return NextResponse.json({
          success: true,
          data: updated,
          message: `Published to ${substackLink}`
        })
      }
      
      case 'schedule': {
        const { scheduledAt } = body
        const updated = await db.content.update({
          where: { id: contentId },
          data: {
            status: ContentStatus.READY_TO_PUBLISH,
            scheduledAt: new Date(scheduledAt)
          }
        })
        
        return NextResponse.json({
          success: true,
          data: updated,
          message: 'Scheduled for publishing'
        })
      }
      
      case 'draft': {
        const updated = await db.content.update({
          where: { id: contentId },
          data: { status: ContentStatus.DRAFT }
        })
        
        return NextResponse.json({
          success: true,
          data: updated,
          message: 'Moved to draft'
        })
      }
      
      case 'archive': {
        const updated = await db.content.update({
          where: { id: contentId },
          data: { status: ContentStatus.ARCHIVED }
        })
        
        return NextResponse.json({
          success: true,
          data: updated,
          message: 'Archived'
        })
      }
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error processing pipeline:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process pipeline action' },
      { status: 500 }
    )
  }
}
