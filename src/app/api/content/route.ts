import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ContentStatus, ContentType } from '@prisma/client'

// GET /api/content - List all content
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as ContentStatus | null
    const type = searchParams.get('type') as ContentType | null
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type
    
    const contents = await db.content.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      }
    })
    
    return NextResponse.json({ success: true, data: contents })
  } catch (error) {
    console.error('Error fetching content:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch content' },
      { status: 500 }
    )
  }
}

// POST /api/content - Create new content
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, body: contentBody, type, tags, authorId } = body
    
    const wordCount = contentBody ? contentBody.split(/\s+/).length : 0
    
    const content = await db.content.create({
      data: {
        title,
        body: contentBody || '',
        type: type || ContentType.POST,
        status: ContentStatus.DRAFT,
        tags,
        wordCount,
        authorId
      }
    })
    
    return NextResponse.json({ success: true, data: content })
  } catch (error) {
    console.error('Error creating content:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create content' },
      { status: 500 }
    )
  }
}
