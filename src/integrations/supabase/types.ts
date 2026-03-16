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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categorias: {
        Row: {
          cor: string | null
          empresa_id: string | null
          id: string
          nome: string
          tipo: string | null
          user_id: string
        }
        Insert: {
          cor?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          tipo?: string | null
          user_id: string
        }
        Update: {
          cor?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          tipo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          empresa_id: string | null
          icone: string | null
          id: string
          nome: string
          saldo_inicial: number | null
          tipo: string | null
          ultima_alteracao_saldo: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          empresa_id?: string | null
          icone?: string | null
          id?: string
          nome: string
          saldo_inicial?: number | null
          tipo?: string | null
          ultima_alteracao_saldo?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          empresa_id?: string | null
          icone?: string | null
          id?: string
          nome?: string
          saldo_inicial?: number | null
          tipo?: string | null
          ultima_alteracao_saldo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_fixas: {
        Row: {
          ativo: boolean | null
          categoria_id: string | null
          conta_id: string
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string
          dia_vencimento: number
          empresa_id: string | null
          id: string
          user_id: string
          valor: number
        }
        Insert: {
          ativo?: boolean | null
          categoria_id?: string | null
          conta_id: string
          created_at?: string | null
          data_fim?: string | null
          data_inicio: string
          descricao: string
          dia_vencimento: number
          empresa_id?: string | null
          id?: string
          user_id: string
          valor: number
        }
        Update: {
          ativo?: boolean | null
          categoria_id?: string | null
          conta_id?: string
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string
          dia_vencimento?: number
          empresa_id?: string | null
          id?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_fixas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_fixas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_fixas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      lancamentos: {
        Row: {
          categoria_id: string | null
          conta_id: string
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          empresa_id: string | null
          id: string
          observacoes: string | null
          status: string | null
          tipo: string
          tipo_recebimento_id: string | null
          user_id: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          conta_id: string
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          status?: string | null
          tipo: string
          tipo_recebimento_id?: string | null
          user_id: string
          valor: number
        }
        Update: {
          categoria_id?: string | null
          conta_id?: string
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          status?: string | null
          tipo?: string
          tipo_recebimento_id?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_tipo_recebimento_id_fkey"
            columns: ["tipo_recebimento_id"]
            isOneToOne: false
            referencedRelation: "tipos_recebimento"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_recebimento: {
        Row: {
          cor: string | null
          created_at: string | null
          icone: string | null
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
