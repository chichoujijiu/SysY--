import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { TestAstType, Person } from './generated/ast.js';
import type { TestServices } from './test-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: TestServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.TestValidator;
    const checks: ValidationChecks<TestAstType> = {
        Person: validator.checkPersonStartsWithCapital
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class TestValidator {

    checkPersonStartsWithCapital(person: Person, accept: ValidationAcceptor): void {
        if (person.name) {
            const firstChar = person.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Person name should start with a capital.', { node: person, property: 'name' });
            }
        }
    }

}
