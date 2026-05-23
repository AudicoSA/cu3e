'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const parentName = formData.get('parentName') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: parentName,
      }
    }
  })

  if (error) {
    redirect('/register?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// Sends a Supabase password-reset email. The link in the email points back
// at /reset-password on whichever origin this request came from — so it works
// from both localhost and the production Vercel URL without hard-coding.
export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get('email') as string)?.trim()
  if (!email) {
    redirect('/forgot-password?error=' + encodeURIComponent('Enter your email.'))
  }

  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
  const proto = hdrs.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : ''

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  })

  // We always show the success state — never reveal whether the email exists.
  if (error) console.error('[auth] resetPasswordForEmail:', error.message)

  redirect('/forgot-password?sent=1')
}

// Finalises a password reset. The user gets here after clicking the email link,
// which exchanges the token for a session via the auth callback (Supabase SSR
// handles that). At this point they're authenticated and can set a new password.
export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string
  if (!password || password.length < 8) {
    redirect('/reset-password?error=' + encodeURIComponent('Password must be at least 8 characters.'))
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    redirect('/reset-password?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function addChild(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const firstName = formData.get('firstName') as string
  const age = parseInt(formData.get('age') as string)
  const tutorName = formData.get('tutorName') as string || 'Echo'
  const school = formData.get('school') as string
  const grade = formData.get('grade') as string
  const rawLang = formData.get('preferredLanguage') as string | null
  const preferredLanguage = rawLang === 'af' || rawLang === 'zu' ? rawLang : 'en'

  const { error } = await supabase
    .from('children')
    .insert({
      parent_id: user.id,
      first_name: firstName,
      age: age,
      ai_tutor_name: tutorName,
      school: school,
      grade: grade,
      preferred_language: preferredLanguage,
    })

  if (error) {
    console.error('Error adding child:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
}
