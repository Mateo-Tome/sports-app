// lib/supabase.ts

import { createClient } from '@supabase/supabase-js';

// ⚠️ YOUR ACTUAL VALUES ARE CORRECTLY DEFINED AS CONSTANTS HERE
// Project URL: https://eycjvrvvvxwrekzghfxt.supabase.co
const SUPABASE_URL = 'https://eycjvrvvvxwrekzghfxt.supabase.co'; 
// Anon Key (Public Key): This is the value you provided
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5Y2p2cnZ2dnh3cmVremdoZnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NTMxOTUsImV4cCI6MjA3NjMyOTE5NX0.V-UXuyoFU0mzwo8_AqZ0Igw2t9aDAMLk7pcoGvMF_GQ'; 

// Initialize the client
// 🚨 FIX: Pass the variable names here, not the raw values again
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to get the logged-in user
export async function getSupabaseUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}