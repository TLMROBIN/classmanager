const LEGACY_DEFAULT_MAINTENANCE_PASSWORD = 'K9x4B2m7Q5w8Z1v3';

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const stripLegacyAdminPasswordFromConfig = (config) => {
    if (!isPlainObject(config)) return config;
    if (!isPlainObject(config.systemConfig)) return config;
    if (!Object.prototype.hasOwnProperty.call(config.systemConfig, 'adminPassword')) return config;
    const { adminPassword, ...restSystemConfig } = config.systemConfig;
    return {
        ...config,
        systemConfig: restSystemConfig
    };
};

const extractLegacyMaintenancePassword = (config) => {
    if (!isPlainObject(config) || !isPlainObject(config.systemConfig)) return null;
    const password = config.systemConfig.adminPassword;
    if (typeof password !== 'string') return null;
    const trimmed = password.trim();
    return trimmed || null;
};

const shouldMigrateLegacyMaintenancePassword = (password) => {
    return typeof password === 'string'
        && password.trim().length > 0
        && password.trim() !== LEGACY_DEFAULT_MAINTENANCE_PASSWORD;
};

module.exports = {
    LEGACY_DEFAULT_MAINTENANCE_PASSWORD,
    stripLegacyAdminPasswordFromConfig,
    extractLegacyMaintenancePassword,
    shouldMigrateLegacyMaintenancePassword
};
