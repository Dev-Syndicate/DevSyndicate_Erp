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
          client_credit: number | null
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
          logo_path: string | null
          lut_number: string
          lut_valid_until: string | null
          organization_id: string
          payment_terms_days: number
          phone: string
          pin_code: string
          quotation_terms: string
          quotation_validity_days: number
          round_off: boolean
          show_sac: boolean
          signatory_designation: string
          signatory_name: string
          signature_path: string | null
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
          logo_path?: string | null
          lut_number?: string
          lut_valid_until?: string | null
          organization_id: string
          payment_terms_days?: number
          phone?: string
          pin_code?: string
          quotation_terms?: string
          quotation_validity_days?: number
          round_off?: boolean
          show_sac?: boolean
          signatory_designation?: string
          signatory_name?: string
          signature_path?: string | null
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
          logo_path?: string | null
          lut_number?: string
          lut_valid_until?: string | null
          organization_id?: string
          payment_terms_days?: number
          phone?: string
          pin_code?: string
          quotation_terms?: string
          quotation_validity_days?: number
          round_off?: boolean
          show_sac?: boolean
          signatory_designation?: string
          signatory_name?: string
          signature_path?: string | null
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
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          file_name: string
          id: string
          mime_type: string
          organization_id: string
          path: string
          size_bytes: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          file_name: string
          id?: string
          mime_type: string
          organization_id: string
          path: string
          size_bytes: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string
          id?: string
          mime_type?: string
          organization_id?: string
          path?: string
          size_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
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
      invoice_items: {
        Row: {
          allocated_discount: number
          cgst: number
          description: string
          discount_type: string
          discount_value: number
          id: string
          igst: number
          invoice_id: string
          line_discount: number
          line_gross: number
          line_net: number
          line_total: number
          organization_id: string
          position: number
          quantity: number
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
          invoice_id: string
          line_discount?: number
          line_gross?: number
          line_net?: number
          line_total?: number
          organization_id: string
          position: number
          quantity: number
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
          invoice_id?: string
          line_discount?: number
          line_gross?: number
          line_net?: number
          line_total?: number
          organization_id?: string
          position?: number
          quantity?: number
          sac_code?: string
          sgst?: number
          tax_rate?: number
          taxable?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_address: string
          billing_gstin: string
          billing_name: string
          cgst_total: number
          client_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          discount_total: number
          discount_type: string
          discount_value: number
          due_date: string
          grand_total: number
          gst_applicable: boolean
          id: string
          igst_total: number
          invoice_date: string
          issued_at: string | null
          issued_by: string | null
          lut_number: string
          notes: string
          number: string | null
          organization_id: string
          over_quotation_reason: string | null
          place_of_supply: string
          quotation_id: string | null
          round_off: number
          sgst_total: number
          status: string
          subtotal: number
          supply_type: string
          taxable_total: number
          terms: string
          updated_at: string
          amount_paid: number | null
          balance_due: number | null
        }
        Insert: {
          billing_address?: string
          billing_gstin?: string
          billing_name?: string
          cgst_total?: number
          client_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_total?: number
          discount_type?: string
          discount_value?: number
          due_date: string
          grand_total?: number
          gst_applicable?: boolean
          id?: string
          igst_total?: number
          invoice_date?: string
          issued_at?: string | null
          issued_by?: string | null
          lut_number?: string
          notes?: string
          number?: string | null
          organization_id: string
          over_quotation_reason?: string | null
          place_of_supply?: string
          quotation_id?: string | null
          round_off?: number
          sgst_total?: number
          status?: string
          subtotal?: number
          supply_type?: string
          taxable_total?: number
          terms?: string
          updated_at?: string
        }
        Update: {
          billing_address?: string
          billing_gstin?: string
          billing_name?: string
          cgst_total?: number
          client_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_total?: number
          discount_type?: string
          discount_value?: number
          due_date?: string
          grand_total?: number
          gst_applicable?: boolean
          id?: string
          igst_total?: number
          invoice_date?: string
          issued_at?: string | null
          issued_by?: string | null
          lut_number?: string
          notes?: string
          number?: string | null
          organization_id?: string
          over_quotation_reason?: string | null
          place_of_supply?: string
          quotation_id?: string | null
          round_off?: number
          sgst_total?: number
          status?: string
          subtotal?: number
          supply_type?: string
          taxable_total?: number
          terms?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
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
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          organization_id: string
          payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          organization_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          organization_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cancel_reason: string | null
          client_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          method: string
          notes: string
          number: string | null
          organization_id: string
          payment_date: string
          reference: string
          status: string
          tds_amount: number
          updated_at: string
          unallocated: number | null
        }
        Insert: {
          amount: number
          cancel_reason?: string | null
          client_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          method: string
          notes?: string
          number?: string | null
          organization_id: string
          payment_date?: string
          reference?: string
          status?: string
          tds_amount?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          client_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          method?: string
          notes?: string
          number?: string | null
          organization_id?: string
          payment_date?: string
          reference?: string
          status?: string
          tds_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          timeline: string
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
          timeline?: string
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
          timeline?: string
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
          invoiced_total: number | null
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
      amount_paid: {
        Args: { "": Database["public"]["Tables"]["invoices"]["Row"] }
        Returns: {
          error: true
        } & "the function public.amount_paid with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache"
      }
      apply_client_credit: { Args: { p_invoice_id: string }; Returns: number }
      apply_payment: {
        Args: { p_amount: number; p_invoice_id: string; p_payment_id: string }
        Returns: undefined
      }
      balance_due: {
        Args: { "": Database["public"]["Tables"]["invoices"]["Row"] }
        Returns: {
          error: true
        } & "the function public.balance_due with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache"
      }
      client_credit: {
        Args: { "": Database["public"]["Tables"]["clients"]["Row"] }
        Returns: {
          error: true
        } & "the function public.client_credit with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache"
      }
      convert_quotation: {
        Args: {
          p_amount?: number
          p_id: string
          p_items?: Json
          p_mode: string
          p_percent?: number
        }
        Returns: string
      }
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
      document_period_key: {
        Args: { p_date: string; p_reset: string }
        Returns: string
      }
      extend_quotation_validity: {
        Args: { p_id: string; p_valid_until: string }
        Returns: undefined
      }
      has_permission: { Args: { p: string }; Returns: boolean }
      invoice_action: {
        Args: { p_action: string; p_id: string; p_reason?: string }
        Returns: string
      }
      invoiced_total: {
        Args: { "": Database["public"]["Tables"]["quotations"]["Row"] }
        Returns: {
          error: true
        } & "the function public.invoiced_total with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache"
      }
      is_super_admin: { Args: { uid: string }; Returns: boolean }
      ist_today: { Args: never; Returns: string }
      my_permissions: { Args: never; Returns: string[] }
      next_document_number: {
        Args: { p_date?: string; p_doc_type: string }
        Returns: string
      }
      payment_action: {
        Args: { p_action: string; p_id: string; p_reason?: string }
        Returns: string
      }
      quotation_action: {
        Args: { p_action: string; p_id: string }
        Returns: string
      }
      recalculate_document: {
        Args: { p_doc: string; p_id: string }
        Returns: undefined
      }
      recalculate_quotation: { Args: { p_id: string }; Returns: undefined }
      render_document_number: {
        Args: {
          p_date: string
          p_padding: number
          p_pattern: string
          p_seq: number
        }
        Returns: string
      }
      save_invoice: { Args: { p_data: Json; p_id: string }; Returns: string }
      save_payment: { Args: { p_data: Json; p_id: string }; Returns: string }
      save_quotation: { Args: { p_data: Json; p_id: string }; Returns: string }
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
      unallocated: {
        Args: { "": Database["public"]["Tables"]["payments"]["Row"] }
        Returns: {
          error: true
        } & "the function public.unallocated with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache"
      }
      unapply_payment: { Args: { p_allocation_id: string }; Returns: undefined }
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

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
