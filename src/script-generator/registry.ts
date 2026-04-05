import { ScriptTemplate } from './types';

export class TemplateRegistry {
    private templates: Map<string, ScriptTemplate> = new Map();

    /**
     * Register a new template
     */
    register(template: ScriptTemplate) {
        if (this.templates.has(template.manifest.id)) {
            console.warn(`Template with ID ${template.manifest.id} already exists. Overwriting.`);
        }
        this.templates.set(template.manifest.id, template);
    }

    /**
     * Get a template by ID
     */
    get(id: string): ScriptTemplate | undefined {
        return this.templates.get(id);
    }

    /**
     * List all registered templates
     */
    list(): ScriptTemplate[] {
        return Array.from(this.templates.values());
    }

    /**
     * Validate a template (basic check)
     */
    validate(template: ScriptTemplate): boolean {
        if (!template.manifest || !template.manifest.id) {
            return false;
        }
        return true;
    }
}

// Singleton instance
export const registry = new TemplateRegistry();
