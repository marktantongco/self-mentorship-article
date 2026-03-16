import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/settings - Get pipeline settings
export async function GET() {
  try {
    let settings = await db.pipelineSettings.findFirst()
    
    if (!settings) {
      settings = await db.pipelineSettings.create({
        data: {}
      })
    }
    
    // Mask sensitive fields
    const maskedSettings = {
      ...settings,
      notionApiKey: settings.notionApiKey ? '••••••••' : null,
      substackApiKey: settings.substackApiKey ? '••••••••' : null
    }
    
    return NextResponse.json({ success: true, data: maskedSettings })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// PUT /api/settings - Update pipeline settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    let settings = await db.pipelineSettings.findFirst()
    
    if (!settings) {
      settings = await db.pipelineSettings.create({
        data: body
      })
    } else {
      settings = await db.pipelineSettings.update({
        where: { id: settings.id },
        data: body
      })
    }
    
    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
