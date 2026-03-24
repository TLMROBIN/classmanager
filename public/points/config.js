(function() {
    window.createPointsConfigHelpers = function createPointsConfigHelpers(deps) {
        const {
            getSystemConfig,
            DEFAULT_SYSTEM_CONFIG
        } = deps || {};

        if (typeof getSystemConfig !== 'function' || !DEFAULT_SYSTEM_CONFIG) {
            throw new Error('Points config dependencies are missing');
        }

        const POINT_SCENES = ["宿舍", "班级", "校级", "其他"];
        const POINT_CATEGORIES = ["待定", "学业", "纪律", "卫生", "兑奖", "出勤", "班务"];
        const DEFAULT_POINT_SCENE = "班级";
        const DEFAULT_POINT_CATEGORY = "纪律";

        const normalizePointScene = (scene) => POINT_SCENES.includes(scene) ? scene : DEFAULT_POINT_SCENE;
        const normalizePointCategory = (category) => POINT_CATEGORIES.includes(category) ? category : DEFAULT_POINT_CATEGORY;

        const getGroupsConfig = (config) => {
            const systemConfig = getSystemConfig(config);
            const groupsObj = {};
            systemConfig.organization.groups.forEach(group => {
                groupsObj[group.id] = { name: group.name, color: group.color };
            });
            return groupsObj;
        };

        const getDormsConfig = (config) => {
            const systemConfig = getSystemConfig(config);
            const dormsObj = {};
            systemConfig.organization.dorms.forEach(dorm => {
                dormsObj[dorm.id] = dorm.name;
            });
            return dormsObj;
        };

        const getReasonsPreset = (config) => {
            const systemConfig = getSystemConfig(config);
            return systemConfig.points.reasons;
        };

        const getSubjectsConfig = (config) => {
            const systemConfig = getSystemConfig(config);
            return systemConfig.subjects || DEFAULT_SYSTEM_CONFIG.subjects;
        };

        return {
            POINT_SCENES,
            POINT_CATEGORIES,
            DEFAULT_POINT_SCENE,
            DEFAULT_POINT_CATEGORY,
            normalizePointScene,
            normalizePointCategory,
            getGroupsConfig,
            getDormsConfig,
            getReasonsPreset,
            getSubjectsConfig
        };
    };
})();
