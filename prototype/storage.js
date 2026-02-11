/**
 * Storage Interface - Abstraction layer for future Supabase integration
 *
 * This module provides a clean interface for saving and loading comparison data.
 * Currently uses localStorage as a stub, but can be easily swapped for Supabase
 * or other backend storage without changing the application code.
 */

class StorageInterface {
  constructor() {
    this.provider = new LocalStorageProvider();
  }

  /**
   * Set the storage provider (LocalStorage, Supabase, etc.)
   * @param {StorageProvider} provider - Storage provider instance
   */
  setProvider(provider) {
    this.provider = provider;
  }

  /**
   * Save a comparison project
   * @param {Object} comparison - Comparison data including options, overrides, metadata
   * @returns {Promise<string>} - Returns the saved comparison ID
   */
  async saveComparison(comparison) {
    return await this.provider.save(comparison);
  }

  /**
   * Load a comparison project by ID
   * @param {string} id - Comparison ID
   * @returns {Promise<Object>} - Comparison data
   */
  async loadComparison(id) {
    return await this.provider.load(id);
  }

  /**
   * List all saved comparisons for the current user
   * @returns {Promise<Array>} - Array of comparison metadata
   */
  async listComparisons() {
    return await this.provider.list();
  }

  /**
   * Delete a comparison by ID
   * @param {string} id - Comparison ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteComparison(id) {
    return await this.provider.delete(id);
  }

  /**
   * Upload a source PDF illustration
   * @param {string} comparisonId - Comparison ID
   * @param {number} optionIndex - Option slot (0-2)
   * @param {File} file - PDF file
   * @returns {Promise<string>} - File URL or ID
   */
  async uploadSourcePdf(comparisonId, optionIndex, file) {
    return await this.provider.uploadFile(comparisonId, optionIndex, file);
  }
}

/**
 * LocalStorage Provider (stub implementation for phase 1)
 */
class LocalStorageProvider {
  constructor() {
    this.storageKey = "insurance_comparisons";
  }

  async save(comparison) {
    const comparisons = this._getAll();
    const id = comparison.id || `comp_${Date.now()}`;
    const timestamp = new Date().toISOString();

    comparisons[id] = {
      ...comparison,
      id,
      updatedAt: timestamp,
      createdAt: comparison.createdAt || timestamp,
    };

    localStorage.setItem(this.storageKey, JSON.stringify(comparisons));
    return id;
  }

  async load(id) {
    const comparisons = this._getAll();
    if (!comparisons[id]) {
      throw new Error(`Comparison ${id} not found`);
    }
    return comparisons[id];
  }

  async list() {
    const comparisons = this._getAll();
    return Object.values(comparisons).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }

  async delete(id) {
    const comparisons = this._getAll();
    delete comparisons[id];
    localStorage.setItem(this.storageKey, JSON.stringify(comparisons));
    return true;
  }

  async uploadFile(comparisonId, optionIndex, file) {
    console.log(`[LocalStorage] File upload stubbed: ${file.name} for comparison ${comparisonId}, option ${optionIndex}`);
    return `local_file_${Date.now()}`;
  }

  _getAll() {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : {};
  }
}

/**
 * Supabase Provider (template for phase 2)
 *
 * To implement:
 * 1. Install Supabase client: npm install @supabase/supabase-js
 * 2. Initialize client with your project URL and anon key
 * 3. Create tables: comparisons, source_pdfs
 * 4. Implement the methods below using Supabase APIs
 */
class SupabaseProvider {
  constructor(supabaseUrl, supabaseKey) {
    // Uncomment when ready to integrate:
    // this.supabase = createClient(supabaseUrl, supabaseKey);
    console.warn("SupabaseProvider not implemented yet");
  }

  async save(comparison) {
    // Example implementation:
    // const { data, error } = await this.supabase
    //   .from('comparisons')
    //   .upsert(comparison)
    //   .select()
    //   .single();
    // if (error) throw error;
    // return data.id;
    throw new Error("Supabase integration not implemented");
  }

  async load(id) {
    // const { data, error } = await this.supabase
    //   .from('comparisons')
    //   .select('*')
    //   .eq('id', id)
    //   .single();
    // if (error) throw error;
    // return data;
    throw new Error("Supabase integration not implemented");
  }

  async list() {
    // const { data, error } = await this.supabase
    //   .from('comparisons')
    //   .select('id, name, updatedAt, createdAt')
    //   .order('updatedAt', { ascending: false });
    // if (error) throw error;
    // return data;
    throw new Error("Supabase integration not implemented");
  }

  async delete(id) {
    // const { error } = await this.supabase
    //   .from('comparisons')
    //   .delete()
    //   .eq('id', id);
    // if (error) throw error;
    // return true;
    throw new Error("Supabase integration not implemented");
  }

  async uploadFile(comparisonId, optionIndex, file) {
    // const filePath = `${comparisonId}/option_${optionIndex}_${file.name}`;
    // const { data, error } = await this.supabase.storage
    //   .from('source_pdfs')
    //   .upload(filePath, file);
    // if (error) throw error;
    // return data.path;
    throw new Error("Supabase integration not implemented");
  }
}

// Export singleton instance
const storage = new StorageInterface();

// For use in HTML scripts
if (typeof window !== "undefined") {
  window.StorageInterface = storage;
}
