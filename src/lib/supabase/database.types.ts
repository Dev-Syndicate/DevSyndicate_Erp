// Generated from the Supabase schema. Regenerate after every migration; do not edit by hand.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: number
          organization_id: string | null
          reason: string | null
          record_id: string | null
          table_name: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: never
          organization_id?: string | null
          reason?: string | null
          record_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: never
          organization_id?: string | null
          reason?: string | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          designation: string
          email: string
          id: string
          is_primary: boolean
          name: string
          organization_id: string
          phone: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          designation?: string
          email?: string
          id?: string
          is_primary?: boolean
          name: string
          organization_id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          designation?: string
          email?: string
          id?: string
          is_primary?: boolean
          name?: string
          organization_id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_address: string
          city: string
          company_name: string
          country: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          gstin: string
          id: string
          notes: string
          organization_id: string
          payment_terms_days: number | null
          pin_code: string
          state: string
          updated_at: string
        }
        Insert: {
          billing_address?: string
          city?: string
          company_name: string
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          gstin?: string
          id?: string
          notes?: string
          organization_id: string
          payment_terms_days?: number | null
          pin_code?: string
          state?: string
          updated_at?: string
        }
        Update: {
          billing_address?: string
          city?: string
          company_name?: string
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          gstin?: string
          id?: string
          notes?: string
          organization_id?: string
          payment_terms_days?: number | null
          pin_code?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string
          bank_account_name: string
          bank_account_number: string
          bank_ifsc: string
          bank_name: string
          city: string
          country: string
          default_sac_code: string
          default_tax_rate_id: string | null
          email: string
          gst_registered: boolean
          gstin: string
          invoice_terms: string
          legal_name: string
          lut_number: string
          lut_valid_until: string | null
          organization_id: string
          payment_terms_days: number
          phone: string
          pin_code: string
          quotation_terms: string
          quotation_validity_days: number
          round_off: boolean
          signatory_name: string
          state: string
          trade_name: string
          updated_at: string
          upi_id: string
          website: string
        }
        Insert: {
          address?: string
          bank_account_name?: string
          bank_account_number?: string
          bank_ifsc?: string
          bank_name?: string
          city?: string
          country?: string
          default_sac_code?: string
          default_tax_rate_id?: string | null
          email?: string
          gst_registered?: boolean
          gstin?: string
          invoice_terms?: string
          legal_name?: string
          lut_number?: string
          lut_valid_until?: string | null
          organization_id: string
          payment_terms_days?: number
          phone?: string
          pin_code?: string
          quotation_terms?: string
          quotation_validity_days?: number
          round_off?: boolean
          signatory_name?: string
          state?: string
          trade_name?: string
          updated_at?: string
          upi_id?: string
          website?: string
        }
        Update: {
          address?: string
          bank_account_name?: string
          bank_account_number?: string
          bank_ifsc?: string
          bank_name?: string
          city?: string
          country?: string
          default_sac_code?: string
          default_tax_rate_id?: string | null
          email?: string
          gst_registered?: boolean
          gstin?: string
          invoice_terms?: string
          legal_name?: string
          lut_number?: string
          lut_valid_until?: string | null
          organization_id?: string
          payment_terms_days?: number
          phone?: string
          pin_code?: string
          quotation_terms?: string
          quotation_validity_days?: number
          round_off?: boolean
          signatory_name?: string
          state?: string
          trade_name?: string
          updated_at?: string
          upi_id?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_default_tax_rate_id_fkey"
            columns: ["default_tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_numbering: {
        Row: {
          doc_type: string
          organization_id: string
          padding: number
          pattern: string
          reset: string
          updated_at: string
        }
        Insert: {
          doc_type: string
          organization_id: string
          padding?: number
          pattern: string
          reset?: string
          updated_at?: string
        }
        Update: {
          doc_type?: string
          organization_id?: string
          padding?: number
          pattern?: string
          reset?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_numbering_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          doc_type: string
          last_value: number
          organization_id: string
          period_key: string
        }
        Insert: {
          doc_type: string
          last_value?: number
          organization_id: string
          period_key: string
        }
        Update: {
          doc_type?: string
          last_value?: number
          organization_id?: string
          period_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_organization_id_doc_type_fkey"
            columns: ["organization_id", "doc_type"]
            isOneToOne: false
            referencedRelation: "document_numbering"
            referencedColumns: ["organization_id", "doc_type"]
          },
          {
            foreignKeyName: "document_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          description: string
          key: string
        }
        Insert: {
          description?: string
          key: string
        }
        Update: {
          description?: string
          key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          organization_id: string
          role_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          organization_id: string
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          allocated_discount: number
          cgst: number
          description: string
          discount_type: string
          discount_value: number
          id: string
          igst: number
          line_discount: number
          line_gross: number
          line_net: number
          line_total: number
          organization_id: string
          position: number
          quantity: number
          quotation_id: string
          sac_code: string
          sgst: number
          tax_rate: number
          taxable: number
          unit_price: number
        }
        Insert: {
          allocated_discount?: number
          cgst?: number
          description: string
          discount_type?: string
          discount_value?: number
          id?: string
          igst?: number
          line_discount?: number
          line_gross?: number
          line_net?: number
          line_total?: number
          organization_id: string
          position: number
          quantity: number
          quotation_id: string
          sac_code?: string
          sgst?: number
          tax_rate?: number
          taxable?: number
          unit_price: number
        }
        Update: {
          allocated_discount?: number
          cgst?: number
          description?: string
          discount_type?: string
          discount_value?: number
          id?: string
          igst?: number
          line_discount?: number
          line_gross?: number
          line_net?: number
          line_total?: number
          organization_id?: string
          position?: number
          quantity?: number
          quotation_id?: string
          sac_code?: string
          sgst?: number
          tax_rate?: number
          taxable?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          cgst_total: number
          client_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string
          discount_total: number
          discount_type: string
          discount_value: number
          grand_total: number
          gst_applicable: boolean
          id: string
          igst_total: number
          notes: string
          number: string | null
          organization_id: string
          place_of_supply: string
          previous_revision_id: string | null
          quotation_date: string
          revision: number
          round_off: number
          sent_at: string | null
          sgst_total: number
          status: string
          subtotal: number
          supply_type: string
          taxable_total: number
          terms: string
          title: string
          updated_at: string
          valid_until: string
        }
        Insert: {
          cgst_total?: number
          client_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          discount_total?: number
          discount_type?: string
          discount_value?: number
          grand_total?: number
          gst_applicable?: boolean
          id?: string
          igst_total?: number
          notes?: string
          number?: string | null
          organization_id: string
          place_of_supply?: string
          previous_revision_id?: string | null
          quotation_date?: string
          revision?: number
          round_off?: number
          sent_at?: string | null
          sgst_total?: number
          status?: string
          subtotal?: number
          supply_type?: string
          taxable_total?: number
          terms?: string
          title: string
          updated_at?: string
          valid_until: string
        }
        Update: {
          cgst_total?: number
          client_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          discount_total?: number
          discount_type?: string
          discount_value?: number
          grand_total?: number
          gst_applicable?: boolean
          id?: string
          igst_total?: number
          notes?: string
          number?: string | null
          organization_id?: string
          place_of_supply?: string
          previous_revision_id?: string | null
          quotation_date?: string
          revision?: number
          round_off?: number
          sent_at?: string | null
          sgst_total?: number
          status?: string
          subtotal?: number
          supply_type?: string
          taxable_total?: number
          terms?: string
          title?: string
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_previous_revision_id_fkey"
            columns: ["previous_revision_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission: string
          role_id: string
        }
        Insert: {
          permission: string
          role_id: string
        }
        Update: {
          permission?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_fkey"
            columns: ["permission"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          key: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          key: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          rate: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string
          contact_person: string
          created_at: string
          created_by: string | null
          default_expense_category_id: string | null
          deleted_at: string | null
          email: string
          gstin: string
          id: string
          name: string
          notes: string
          organization_id: string
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string
          contact_person?: string
          created_at?: string
          created_by?: string | null
          default_expense_category_id?: string | null
          deleted_at?: string | null
          email?: string
          gstin?: string
          id?: string
          name: string
          notes?: string
          organization_id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          contact_person?: string
          created_at?: string
          created_by?: string | null
          default_expense_category_id?: string | null
          deleted_at?: string | null
          email?: string
          gstin?: string
          id?: string
          name?: string
          notes?: string
          organization_id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_default_expense_category_id_fkey"
            columns: ["default_expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
      document_numbering_settings: {
        Args: never
        Returns: {
          doc_type: string
          next_value: number
          padding: number
          pattern: string
          reset: string
        }[]
      }
      document_period_key: { Args: { p_date: string; p_reset: string }; Returns: string }
      extend_quotation_validity: {
        Args: { p_id: string; p_valid_until: string }
        Returns: undefined
      }
      has_permission: { Args: { p: string }; Returns: boolean }
      ist_today: { Args: never; Returns: string }
      is_super_admin: { Args: { uid: string }; Returns: boolean }
      my_permissions: { Args: never; Returns: string[] }
      quotation_action: { Args: { p_action: string; p_id: string }; Returns: string }
      render_document_number: {
        Args: { p_date: string; p_padding: number; p_pattern: string; p_seq: number }
        Returns: string
      }
      save_quotation: { Args: { p_data: Json; p_id: string | null }; Returns: string }
      set_document_numbering: {
        Args: {
          p_doc_type: string
          p_next_value: number
          p_padding: number
          p_pattern: string
          p_reset: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
