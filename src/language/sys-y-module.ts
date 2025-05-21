import { type Module, inject } from 'langium';
import { createDefaultModule, createDefaultSharedModule, type DefaultSharedModuleContext, type LangiumServices, type LangiumSharedServices, type PartialLangiumServices } from 'langium/lsp';
import { SysYGeneratedModule, SysYGeneratedSharedModule } from './generated/module.js';
import { validationChecks } from './sys-y-validator.js';
import { ValidationRegistry } from 'langium';

/**
 * SysY验证器实现类
 */
export class SysYValidator {
    register(registry: ValidationRegistry) {
        registry.register(validationChecks);
    }
}

/**
 * 注册验证规则到验证注册表
 */
export function registerValidationChecks(services: SysYServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.SysYValidator;
    validator.register(registry);
}

/**
 * 声明自定义服务
 */
export type SysYAddedServices = {
    validation: {
        SysYValidator: SysYValidator
    }
}

/**
 * 将Langium默认服务与自定义服务合并
 */
export type SysYServices = LangiumServices & SysYAddedServices

/**
 * 依赖注入模块，覆盖默认服务并添加自定义服务
 */
export const SysYModule: Module<SysYServices, PartialLangiumServices & SysYAddedServices> = {
    validation: {
        SysYValidator: () => new SysYValidator()
    }
};

/**
 * 创建SysY语言服务
 *
 * 首先注入共享服务：
 *  - Langium默认共享服务
 *  - Langium-cli生成的服务
 *
 * 然后注入特定于语言的服务：
 *  - Langium默认语言服务
 *  - Langium-cli生成的服务
 *  - 本文件中指定的服务
 *
 * @param context 可选的模块上下文，包含LSP连接
 * @returns 包含共享服务和特定于语言服务的对象
 */
export function createSysYServices(context: DefaultSharedModuleContext): {
    shared: LangiumSharedServices,
    SysY: SysYServices
} {
    const shared = inject(
        createDefaultSharedModule(context),
        SysYGeneratedSharedModule
    );
    const SysY = inject(
        createDefaultModule({ shared }),
        SysYGeneratedModule,
        SysYModule
    );
    shared.ServiceRegistry.register(SysY);
    registerValidationChecks(SysY);
    if (!context.connection) {
        // 不在语言服务器内运行时
        // 立即初始化配置提供者
        shared.workspace.ConfigurationProvider.initialized({});
    }
    return { shared, SysY };
}
