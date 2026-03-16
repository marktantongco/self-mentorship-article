import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ContentStatus } from '@prisma/client'

// GET /api/content/[id] - Get single content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const content = await db.content.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        campaigns: true
      }
    })
    
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Content not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true, data: content })
  } catch (error) {
    console.error('Error fetching content:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch content' },
      { status: 500 }
    )
  }
}

// PUT /api/content/[id] - Update content
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, body: contentBody, type, status, tags, scheduledAt, notionPageId } = body
    
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (contentBody !== undefined) {
      updateData.body = contentBody
      updateData.wordCount = contentBody.split(/\s+/).length
    }
    if (type !== undefined) updateData.type = type
    if (status !== undefined) {
      updateData.status = status
      if (status === ContentStatus.PUBLISHED) {
        updateData.publishedAt = new Date()
      }
    }
    if (tags !== undefined) updateData.tags = tags
    if (scheduledAt !== undefined) updateData.scheduledAt = new Date(scheduledAt)
    if (notionPageId !== undefined) updateData.notionPageId = notionPageId
    
    const content = await db.content.update({
      where: { id },
      data: updateData
    })
    
    return NextResponse.json({ success: true, data: content })
  } catch (error) {
    console.error('Error updating content:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update content' },
      { status: 500 }
    )
  }
}

// DELETE /api/content/[id] - Delete content
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    await db.content.delete({
      where: { id }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting content:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete content' },
      { status: 500 }
    )
  }
}
