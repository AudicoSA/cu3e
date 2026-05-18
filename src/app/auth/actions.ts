'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

export async function addChild(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const firstName = formData.get('firstName') as string
  const age = parseInt(formData.get('age') as string)
  const tutorName = formData.get('tutorName') as string || 'Echo'
  const school = formData.get('school') as string
  const grade = formData.get('grade') as string

  const { error } = await supabase
    .from('children')
    .insert({
      parent_id: user.id,
      first_name: firstName,
      age: age,
      ai_tutor_name: tutorName,
      school: school,
      grade: grade
    })

  if (error) {
    console.error('Error adding child:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
}
