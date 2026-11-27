const crypto = require('crypto');

const STD_EVENTS = Object.freeze({
    POINTS_CHANGED: 'std.points.changed@1',
    ATTENDANCE_RECORDED: 'std.attendance.recorded@1',
    GROUP_UPDATED: 'std.group.updated@1',
    TASK_COMPLETED: 'std.task.completed@1'
});

const stripEventVersion = (eventName) => String(eventName || '').replace(/@\d+$/, '');

const matchesEventPattern = (pattern, eventName) => {
    if (pattern === '*') return true;
    if (pattern === eventName) return true;
    if (!pattern.includes('@') && stripEventVersion(eventName) === pattern) {
        return true;
    }
    return false;
};

/**
 * Create a class-isolated dual-layer event bus supporting std.*@version and custom.* events.
 */
const createEventBus = ({ maxHistoryPerClass = 200 } = {}) => {
    const subscriptions = new Set();
    const historyByClass = new Map();
    const limit = Math.max(1, Number(maxHistoryPerClass) || 200);

    const subscribe = (eventName, handler, options = {}) => {
        if (typeof handler !== 'function') {
            throw new TypeError('eventBus.subscribe requires a handler function');
        }
        const entry = {
            pattern: String(eventName || '*'),
            classId: options.classId ? String(options.classId) : null,
            handler
        };
        subscriptions.add(entry);
        return () => {
            subscriptions.delete(entry);
        };
    };

    const emit = ({ classId, eventName, payload = {}, sourcePluginId = 'core', timestamp = Date.now() }) => {
        const normalizedClassId = String(classId || '');
        const normalizedEventName = String(eventName || '');
        if (!normalizedClassId || !normalizedEventName) {
            return null;
        }

        const envelope = {
            id: `evt_${crypto.randomBytes(8).toString('hex')}`,
            classId: normalizedClassId,
            eventName: normalizedEventName,
            payload,
            sourcePluginId: String(sourcePluginId || 'core'),
            timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now()
        };

        const list = historyByClass.get(normalizedClassId) || [];
        list.unshift(envelope);
        if (list.length > limit) {
            list.length = limit;
        }
        historyByClass.set(normalizedClassId, list);

        for (const sub of subscriptions) {
            if (sub.classId && sub.classId !== normalizedClassId) continue;
            if (!matchesEventPattern(sub.pattern, normalizedEventName)) continue;
            try {
                sub.handler(envelope);
            } catch (err) {
                console.error(`[EventBus] subscriber error for ${normalizedEventName}:`, err);
            }
        }

        return envelope;
    };

    const getRecentEvents = (classId, maxCount = 50) => {
        const normalizedClassId = String(classId || '');
        const list = historyByClass.get(normalizedClassId) || [];
        const count = Math.max(0, Math.min(limit, Number(maxCount) || 50));
        return list.slice(0, count);
    };

    return {
        subscribe,
        emit,
        getRecentEvents
    };
};

module.exports = {
    STD_EVENTS,
    createEventBus
};
