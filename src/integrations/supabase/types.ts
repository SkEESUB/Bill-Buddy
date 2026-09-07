export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      spending_goals: {
        Row: {
          category: string | null
          created_at: string
          current_amount: number
          description: string | null
          id: string
          status: "active" | "completed" | "cancelled"
          target_amount: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_amount?: number
          description?: string | null
          id?: string
          status?: "active" | "completed" | "cancelled"
          target_amount: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          current_amount?: number
          description?: string | null
          id?: string
          status?: "active" | "completed" | "cancelled"
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bill_reminders: {
        Row: {
          bill_occurrence_id: string
          created_at: string
          id: string
          reminder_type: "email" | "push" | "in_app"
          scheduled_for: string
          sent_at: string | null
          status: "pending" | "sent" | "failed" | "cancelled"
          user_id: string
        }
        Insert: {
          bill_occurrence_id: string
          created_at?: string
          id?: string
          reminder_type: "email" | "push" | "in_app"
          scheduled_for: string
          sent_at?: string | null
          status?: "pending" | "sent" | "failed" | "cancelled"
          user_id: string
        }
        Update: {
          bill_occurrence_id?: string
          created_at?: string
          id?: string
          reminder_type?: "email" | "push" | "in_app"
          scheduled_for?: string
          sent_at?: string | null
          status?: "pending" | "sent" | "failed" | "cancelled"
          user_id?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          bill_id: string | null
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          storage_path: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          bill_id?: string | null
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          storage_path: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          bill_id?: string | null
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_role: string | null
          actor_type: string
          actor_user_id: string | null
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          result: string
          user_id: string | null
        }
        Insert: {
          action: string
          actor_role?: string | null
          actor_type?: string
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          result?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_role?: string | null
          actor_type?: string
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          result?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bill_occurrences: {
        Row: {
          actual_amount: number | null
          bill_id: string
          created_at: string
          expected_amount: number
          id: string
          paid_at: string | null
          scheduled_date: string
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_amount?: number | null
          bill_id: string
          created_at?: string
          expected_amount: number
          id?: string
          paid_at?: string | null
          scheduled_date: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_amount?: number | null
          bill_id?: string
          created_at?: string
          expected_amount?: number
          id?: string
          paid_at?: string | null
          scheduled_date?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_occurrences_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_occurrences_transaction_fk"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount: number
          amount_type: string
          autopay_enabled: boolean
          category: string
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          due_date: string
          id: string
          is_active: boolean
          is_recurring: boolean
          notes: string | null
          recurring_type: string | null
          reminder_days_before: number
          repeat_end_date: string | null
          repeat_interval: number
          repeat_type: string
          title: string
          updated_at: string
          upi_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          amount_type?: string
          autopay_enabled?: boolean
          category?: string
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          notes?: string | null
          recurring_type?: string | null
          reminder_days_before?: number
          repeat_end_date?: string | null
          repeat_interval?: number
          repeat_type?: string
          title: string
          updated_at?: string
          upi_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          amount_type?: string
          autopay_enabled?: boolean
          category?: string
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          notes?: string | null
          recurring_type?: string | null
          reminder_days_before?: number
          repeat_end_date?: string | null
          repeat_interval?: number
          repeat_type?: string
          title?: string
          updated_at?: string
          upi_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category: string
          category_id: string | null
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string | null
          near_limit_threshold: number
          period: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
          warn_threshold: number
        }
        Insert: {
          amount: number
          category: string
          category_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          near_limit_threshold?: number
          period?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
          warn_threshold?: number
        }
        Update: {
          amount?: number
          category?: string
          category_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          near_limit_threshold?: number
          period?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          warn_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      closed_accounts: {
        Row: {
          closed_at: string
          id: string
          reason: string | null
          retained_summary: Json
        }
        Insert: {
          closed_at?: string
          id?: string
          reason?: string | null
          retained_summary?: Json
        }
        Update: {
          closed_at?: string
          id?: string
          reason?: string | null
          retained_summary?: Json
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          created: number
          created_at: string
          details: Json
          duration_ms: number | null
          error: string | null
          failed: number
          finished_at: string | null
          id: string
          job: string
          processed: number
          retry_count: number
          run_key: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created?: number
          created_at?: string
          details?: Json
          duration_ms?: number | null
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          job: string
          processed?: number
          retry_count?: number
          run_key: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created?: number
          created_at?: string
          details?: Json
          duration_ms?: number | null
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          job?: string
          processed?: number
          retry_count?: number
          run_key?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          bill_reminders: boolean
          budget_alerts: boolean
          created_at: string
          id: string
          overdue_alerts: boolean
          payment_confirmations: boolean
          security_alerts: boolean
          updated_at: string
          user_id: string
          weekly_summary: boolean
        }
        Insert: {
          bill_reminders?: boolean
          budget_alerts?: boolean
          created_at?: string
          id?: string
          overdue_alerts?: boolean
          payment_confirmations?: boolean
          security_alerts?: boolean
          updated_at?: string
          user_id: string
          weekly_summary?: boolean
        }
        Update: {
          bill_reminders?: boolean
          budget_alerts?: boolean
          created_at?: string
          id?: string
          overdue_alerts?: boolean
          payment_confirmations?: boolean
          security_alerts?: boolean
          updated_at?: string
          user_id?: string
          weekly_summary?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          read_at: string | null
          related_bill_id: string | null
          related_budget_id: string | null
          related_transaction_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          read_at?: string | null
          related_bill_id?: string | null
          related_budget_id?: string | null
          related_transaction_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          read_at?: string | null
          related_bill_id?: string | null
          related_budget_id?: string | null
          related_transaction_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_bill_id_fkey"
            columns: ["related_bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_budget_id_fkey"
            columns: ["related_budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_transaction_id_fkey"
            columns: ["related_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          method: string | null
          payment_order_id: string
          provider: string
          provider_payment_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          method?: string | null
          payment_order_id: string
          provider: string
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          method?: string | null
          payment_order_id?: string
          provider?: string
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          payment_order_id: string | null
          process_error: string | null
          processed: boolean
          processed_at: string | null
          provider: string
          provider_event_id: string
          provider_payment_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          payment_order_id?: string | null
          process_error?: string | null
          processed?: boolean
          processed_at?: string | null
          provider: string
          provider_event_id: string
          provider_payment_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          payment_order_id?: string | null
          process_error?: string | null
          processed?: boolean
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          provider_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_orders: {
        Row: {
          amount: number
          bill_occurrence_id: string
          captured_at: string | null
          created_at: string
          currency: string
          expires_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          metadata: Json
          provider: string
          provider_order_id: string | null
          refunded_amount: number
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bill_occurrence_id: string
          captured_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          provider: string
          provider_order_id?: string | null
          refunded_amount?: number
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bill_occurrence_id?: string
          captured_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          provider?: string
          provider_order_id?: string | null
          refunded_amount?: number
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_bill_occurrence_id_fkey"
            columns: ["bill_occurrence_id"]
            isOneToOne: false
            referencedRelation: "bill_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          id: string
          payment_date: string
          payment_method: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          id?: string
          payment_date?: string
          payment_method?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          id?: string
          payment_date?: string
          payment_method?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          avatar_url: string | null
          created_at: string
          default_upi_id: string | null
          full_name: string | null
          id: string
          mobile: string | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          status_changed_at: string | null
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          created_at?: string
          default_upi_id?: string | null
          full_name?: string | null
          id: string
          mobile?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          status_changed_at?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          created_at?: string
          default_upi_id?: string | null
          full_name?: string | null
          id?: string
          mobile?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          status_changed_at?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          author_type: string
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_type: string
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_type?: string
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description: string
          id?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          bill_occurrence_id: string | null
          category: string
          category_id: string | null
          client_request_id: string | null
          created_at: string
          currency: string
          date: string
          description: string | null
          external_reference: string | null
          id: string
          notes: string | null
          payment_method: string | null
          reversal_of: string | null
          reversed_by: string | null
          source: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bill_occurrence_id?: string | null
          category: string
          category_id?: string | null
          client_request_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          description?: string | null
          external_reference?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          reversal_of?: string | null
          reversed_by?: string | null
          source?: string
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bill_occurrence_id?: string | null
          category?: string
          category_id?: string | null
          client_request_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          description?: string | null
          external_reference?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          reversal_of?: string | null
          reversed_by?: string | null
          source?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bill_occurrence_id_fkey"
            columns: ["bill_occurrence_id"]
            isOneToOne: false
            referencedRelation: "bill_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          currency: string
          default_budget_period: string
          default_near_limit_threshold: number
          default_warn_threshold: number
          monthly_budget: number
          monthly_income: number
          notify_bill_reminders: boolean
          notify_due_today: boolean
          notify_due_tomorrow: boolean
          notify_monthly_summary: boolean
          notify_overdue: boolean
          notify_payment_recorded: boolean
          notify_weekly_summary: boolean
          reduced_motion: boolean
          starting_balance: number
          theme: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          default_budget_period?: string
          default_near_limit_threshold?: number
          default_warn_threshold?: number
          monthly_budget?: number
          monthly_income?: number
          notify_bill_reminders?: boolean
          notify_due_today?: boolean
          notify_due_tomorrow?: boolean
          notify_monthly_summary?: boolean
          notify_overdue?: boolean
          notify_payment_recorded?: boolean
          notify_weekly_summary?: boolean
          reduced_motion?: boolean
          starting_balance?: number
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          default_budget_period?: string
          default_near_limit_threshold?: number
          default_warn_threshold?: number
          monthly_budget?: number
          monthly_income?: number
          notify_bill_reminders?: boolean
          notify_due_today?: boolean
          notify_due_tomorrow?: boolean
          notify_monthly_summary?: boolean
          notify_overdue?: boolean
          notify_payment_recorded?: boolean
          notify_weekly_summary?: boolean
          reduced_motion?: boolean
          starting_balance?: number
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ledger_balance_delta: { Args: never; Returns: number }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "support_admin"
        | "finance_admin"
        | "readonly_admin"
        | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "support_admin",
        "finance_admin",
        "readonly_admin",
        "user",
      ],
    },
  },
} as const
