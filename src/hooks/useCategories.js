import { CATEGORIES } from '../utils/constants'

// Categories are now fixed constants, not user-editable
export function useCategories() {
  return {
    categories: CATEGORIES
  }
}
