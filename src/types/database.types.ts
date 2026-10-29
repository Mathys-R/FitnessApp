// src/types/database.types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          current_target_kcal: number;
          current_target_p: number;
          current_target_g: number;
          current_target_l: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          current_target_kcal?: number;
          current_target_p?: number;
          current_target_g?: number;
          current_target_l?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          current_target_kcal?: number;
          current_target_p?: number;
          current_target_g?: number;
          current_target_l?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      daily_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          weight_kg: number | null;
          weight_ema_kg: number | null;
          steps_count: number | null;
          target_kcal: number;
          target_p: number;
          target_g: number;
          target_l: number;
          exclude_from_tdee: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          log_date: string;
          weight_kg?: number | null;
          weight_ema_kg?: number | null;
          steps_count?: number | null;
          target_kcal?: number;
          target_p?: number;
          target_g?: number;
          target_l?: number;
          exclude_from_tdee?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          log_date?: string;
          weight_kg?: number | null;
          weight_ema_kg?: number | null;
          steps_count?: number | null;
          target_kcal?: number;
          target_p?: number;
          target_g?: number;
          target_l?: number;
          exclude_from_tdee?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          primary_muscle: string;
          secondary_muscles: Json;
          image_url: string | null;
          setup_guide: string | null;
          is_archived: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          primary_muscle: string;
          secondary_muscles?: Json;
          image_url?: string | null;
          setup_guide?: string | null;
          is_archived?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          primary_muscle?: string;
          secondary_muscles?: Json;
          image_url?: string | null;
          setup_guide?: string | null;
          is_archived?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
      };
      user_exercise_notes: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          pinned_note: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_id: string;
          pinned_note: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_id?: string;
          pinned_note?: string;
          updated_at?: string;
        };
      };
      workout_presets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workout_preset_exercises: {
        Row: {
          id: string;
          preset_id: string;
          exercise_id: string;
          order_index: number;
          target_sets: number;
          target_rest_seconds: number;
          default_reps: number | null;
          default_weight_kg: number | null;
        };
        Insert: {
          id?: string;
          preset_id: string;
          exercise_id: string;
          order_index?: number;
          target_sets?: number;
          target_rest_seconds?: number;
          default_reps?: number | null;
          default_weight_kg?: number | null;
        };
        Update: {
          id?: string;
          preset_id?: string;
          exercise_id?: string;
          order_index?: number;
          target_sets?: number;
          target_rest_seconds?: number;
          default_reps?: number | null;
          default_weight_kg?: number | null;
        };
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_date: string;
          name: string;
          status: Database['public']['Enums']['workout_session_status'];
          preset_id: string | null;
          duration_seconds: number | null;
          session_comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_date: string;
          name: string;
          status?: Database['public']['Enums']['workout_session_status'];
          preset_id?: string | null;
          duration_seconds?: number | null;
          session_comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_date?: string;
          name?: string;
          status?: Database['public']['Enums']['workout_session_status'];
          preset_id?: string | null;
          duration_seconds?: number | null;
          session_comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workout_session_exercises: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          exercise_id: string;
          order_index: number;
          session_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          exercise_id: string;
          order_index?: number;
          session_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          exercise_id?: string;
          order_index?: number;
          session_note?: string | null;
          created_at?: string;
        };
      };
      workout_sets: {
        Row: {
          id: string;
          session_exercise_id: string;
          user_id: string;
          exercise_id: string;
          set_number: number;
          weight_kg: number;
          reps: number;
          rest_seconds: number;
          is_warmup: boolean;
          is_completed: boolean;
          epley_1rm: number;
          is_pr: boolean;
          performed_at: string;
        };
        Insert: {
          id?: string;
          session_exercise_id: string;
          user_id: string;
          exercise_id: string;
          set_number: number;
          weight_kg?: number;
          reps?: number;
          rest_seconds?: number;
          is_warmup?: boolean;
          is_completed?: boolean;
          is_pr?: boolean;
          performed_at?: string;
        };
        Update: {
          id?: string;
          session_exercise_id?: string;
          user_id?: string;
          exercise_id?: string;
          set_number?: number;
          weight_kg?: number;
          reps?: number;
          rest_seconds?: number;
          is_warmup?: boolean;
          is_completed?: boolean;
          is_pr?: boolean;
          performed_at?: string;
        };
      };
      foods: {
        Row: {
          id: string;
          name: string;
          brand: string | null;
          barcode: string | null;
          serving_type: Database['public']['Enums']['food_serving_type'];
          unit_weight_g: number;
          kcal_per_base: number;
          proteins_per_base: number;
          carbs_per_base: number;
          fats_per_base: number;
          is_archived: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          brand?: string | null;
          barcode?: string | null;
          serving_type?: Database['public']['Enums']['food_serving_type'];
          unit_weight_g?: number;
          kcal_per_base?: number;
          proteins_per_base?: number;
          carbs_per_base?: number;
          fats_per_base?: number;
          is_archived?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          brand?: string | null;
          barcode?: string | null;
          serving_type?: Database['public']['Enums']['food_serving_type'];
          unit_weight_g?: number;
          kcal_per_base?: number;
          proteins_per_base?: number;
          carbs_per_base?: number;
          fats_per_base?: number;
          is_archived?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
      };
      recipes: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_archived: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_archived?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          is_archived?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          food_id: string;
          quantity_value: number;
          logged_unit: Database['public']['Enums']['logged_unit_type'];
        };
        Insert: {
          id?: string;
          recipe_id: string;
          food_id: string;
          quantity_value: number;
          logged_unit?: Database['public']['Enums']['logged_unit_type'];
        };
        Update: {
          id?: string;
          recipe_id?: string;
          food_id?: string;
          quantity_value?: number;
          logged_unit?: Database['public']['Enums']['logged_unit_type'];
        };
      };
      meal_entries: {
        Row: {
          id: string;
          daily_log_id: string;
          user_id: string;
          meal_type: Database['public']['Enums']['meal_category'];
          entry_type: Database['public']['Enums']['meal_entry_type'];
          label: string;
          food_id: string | null;
          recipe_id: string | null;
          quantity_value: number | null;
          logged_unit: Database['public']['Enums']['logged_unit_type'] | null;
          total_kcal: number;
          total_p: number;
          total_g: number;
          total_l: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          daily_log_id: string;
          user_id: string;
          meal_type: Database['public']['Enums']['meal_category'];
          entry_type: Database['public']['Enums']['meal_entry_type'];
          label: string;
          food_id?: string | null;
          recipe_id?: string | null;
          quantity_value?: number | null;
          logged_unit?: Database['public']['Enums']['logged_unit_type'] | null;
          total_kcal?: number;
          total_p?: number;
          total_g?: number;
          total_l?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          daily_log_id?: string;
          user_id?: string;
          meal_type?: Database['public']['Enums']['meal_category'];
          entry_type?: Database['public']['Enums']['meal_entry_type'];
          label?: string;
          food_id?: string | null;
          recipe_id?: string | null;
          quantity_value?: number | null;
          logged_unit?: Database['public']['Enums']['logged_unit_type'] | null;
          total_kcal?: number;
          total_p?: number;
          total_g?: number;
          total_l?: number;
          created_at?: string;
        };
      };
      meal_entry_items: {
        Row: {
          id: string;
          meal_entry_id: string;
          user_id: string;
          food_id: string | null;
          ingredient_name: string;
          serving_type: Database['public']['Enums']['food_serving_type'];
          unit_weight_g: number;
          logged_unit: Database['public']['Enums']['logged_unit_type'];
          kcal_per_base: number;
          p_per_base: number;
          g_per_base: number;
          l_per_base: number;
          quantity_value: number;
          kcal: number;
          p: number;
          g: number;
          l: number;
        };
        Insert: {
          id?: string;
          meal_entry_id: string;
          user_id: string;
          food_id?: string | null;
          ingredient_name: string;
          serving_type?: Database['public']['Enums']['food_serving_type'];
          unit_weight_g?: number;
          logged_unit?: Database['public']['Enums']['logged_unit_type'];
          kcal_per_base?: number;
          p_per_base?: number;
          g_per_base?: number;
          l_per_base?: number;
          quantity_value: number;
          kcal?: number;
          p?: number;
          g?: number;
          l?: number;
        };
        Update: {
          id?: string;
          meal_entry_id?: string;
          user_id?: string;
          food_id?: string | null;
          ingredient_name?: string;
          serving_type?: Database['public']['Enums']['food_serving_type'];
          unit_weight_g?: number;
          logged_unit?: Database['public']['Enums']['logged_unit_type'];
          kcal_per_base?: number;
          p_per_base?: number;
          g_per_base?: number;
          l_per_base?: number;
          quantity_value?: number;
          kcal?: number;
          p?: number;
          g?: number;
          l?: number;
        };
      };
    };
    Functions: {
      get_partner_info: {
        Args: Record<string, never>;
        Returns: Array<{ partner_id: string; partner_name: string }>;
      };
      copy_meal_entries: {
        Args: {
          p_source_user_id: string;
          p_source_date: string;
          p_source_meal_type: Database['public']['Enums']['meal_category'];
          p_target_daily_log_id: string;
          p_target_meal_type: Database['public']['Enums']['meal_category'];
        };
        Returns: number;
      };
      keepalive_ping: {
        Args: Record<string, never>;
        Returns: Json;
      };
    };
    Enums: {
      food_serving_type: '100g' | 'unit' | 'both';
      logged_unit_type: 'g' | 'unit';
      meal_category: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_post_workout';
      meal_entry_type: 'quick_add' | 'food' | 'recipe';
      workout_session_status: 'planned' | 'in_progress' | 'completed' | 'rest_day';
    };
  };
}

