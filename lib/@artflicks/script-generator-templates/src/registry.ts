import { ScriptTemplate } from './types';

export class TemplateRegistry {
    private templates: Map<string, ScriptTemplate> = new Map();

    register(template: ScriptTemplate) {
        if (this.templates.has(template.manifest.id)) {
            console.warn(`Template with ID ${template.manifest.id} already exists. Overwriting.`);
        }
        this.templates.set(template.manifest.id, template);
    }

    get(id: string): ScriptTemplate | undefined {
        return this.templates.get(id);
    }

    list(): ScriptTemplate[] {
        return Array.from(this.templates.values());
    }

    validate(template: ScriptTemplate): boolean {
        if (!template.manifest || !template.manifest.id) {
            return false;
        }
        return true;
    }
}

export const registry = new TemplateRegistry();
