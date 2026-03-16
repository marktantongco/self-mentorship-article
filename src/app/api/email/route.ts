import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/email - Get email campaigns
export async function GET() {
  try {
    const campaigns = await db.emailCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        content: {
          select: { id: true, title: true, type: true }
        }
      }
    })
    
    return NextResponse.json({ success: true, data: campaigns })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}

// POST /api/email - Send email campaign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contentId, subject, recipients } = body
    
    let emailBody = body.body
    let emailSubject = subject
    
    // If contentId provided, use content as body
    if (contentId) {
      const content = await db.content.findUnique({
        where: { id: contentId }
      })
      
      if (!content) {
        return NextResponse.json(
          { success: false, error: 'Content not found' },
          { status: 404 }
        )
      }
      
      emailBody = content.body
      emailSubject = emailSubject || content.title
      
      // Mark content as emailed
      await db.content.update({
        where: { id: contentId },
        data: {
          emailSent: true,
          emailSentAt: new Date()
        }
      })
    }
    
    // Create campaign record
    const campaign = await db.emailCampaign.create({
      data: {
        subject: emailSubject,
        body: emailBody || '',
        contentId,
        sent: true,
        sentAt: new Date(),
        recipientCount: recipients?.length || 1
      }
    })
    
    // In production, integrate with email service (Resend, SendGrid, etc.)
    // For demo, we simulate sending
    console.log(`📧 Email sent: "${emailSubject}" to ${recipients?.length || 1} recipients`)
    
    return NextResponse.json({
      success: true,
      data: campaign,
      message: `Email "${emailSubject}" sent successfully`
    })
  } catch (error) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
