import type { Category } from '../types'
import { CATEGORIES } from '../utils/constants'

interface UseCategoriesReturn {
    categories: Category[]
}

// Categories are fixed constants, not user-editable
export function useCategories(): UseCategoriesReturn {
    return {
        categories: CATEGORIES
    }
}
