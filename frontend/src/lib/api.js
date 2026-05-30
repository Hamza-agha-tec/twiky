export const api = {
    auth: {
        me: async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (!res.ok) return null;
                const data = await res.json();
                return data.user || data;
            } catch (e) {
                return null;
            }
        }
    },
    entities: new Proxy({}, {
        get: (target, entityName) => {
            const tableName = entityName
                .replace(/([a-z])([A-Z])/g, '$1_$2')
                .toLowerCase() + (entityName.endsWith('s') ? '' : 's');

            let finalTableName = tableName;
            if (entityName === 'UserSettings') finalTableName = 'user_settings';
            if (entityName === 'HabitLog') finalTableName = 'habit_logs';
            if (entityName === 'Health') finalTableName = 'health_records';
            if (entityName === 'Finance') finalTableName = 'finance_records';
            if (entityName === 'Learning') finalTableName = 'learning';
            if (entityName === 'LearningNote') finalTableName = 'learning_notes';
            if (entityName === 'Journal') finalTableName = 'journal_entries';
            if (entityName === 'Event') finalTableName = 'events';
            if (entityName === 'Idea') finalTableName = 'ideas';
            if (entityName === 'Media') finalTableName = 'media_items';
            if (entityName === 'Notification') finalTableName = 'notifications';
            if (entityName === 'Goal') finalTableName = 'goals';
            if (entityName === 'GoalNote') finalTableName = 'goal_notes';
            if (entityName === 'GoalSubMilestone') finalTableName = 'goal_sub_milestones';
            if (entityName === 'RoutineTask') finalTableName = 'routine_tasks';
            if (entityName === 'TravelPin') finalTableName = 'travel_pins';
            if (entityName === 'TeamMember') finalTableName = 'team_members';
            if (entityName === 'TeamMessage') finalTableName = 'team_messages';
            if (entityName === 'TeamActivity') finalTableName = 'team_activities';
            if (entityName === 'Whiteboard' || entityName === 'WhiteBoard') finalTableName = 'whiteboards';

            return {
                list: async (orderOrParams, limit) => {
                    const params = new URLSearchParams();
                    if (typeof orderOrParams === 'string' && orderOrParams.includes('=')) {
                        const extra = new URLSearchParams(orderOrParams);
                        extra.forEach((v, k) => params.set(k, v));
                    } else if (orderOrParams) {
                        params.append('order', orderOrParams);
                    }
                    if (limit) params.append('limit', limit.toString());
                    const res = await fetch(`/api/${finalTableName}?${params.toString()}`);
                    if (!res.ok) throw new Error(await res.text());
                    const data = await res.json();
                    return data[finalTableName] || data.data || data;
                },
                create: async (data) => {
                    const res = await fetch(`/api/${finalTableName}`, {
                        method: 'POST',
                        body: JSON.stringify(data),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (!res.ok) throw new Error(await res.text());
                    return res.json();
                },
                update: async (id, data) => {
                    const res = await fetch(`/api/${finalTableName}/${id}`, {
                        method: 'PATCH',
                        body: JSON.stringify(data),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (!res.ok) throw new Error(await res.text());
                    return res.json();
                },
                delete: async (id, extraParams = {}) => {
                    const params = new URLSearchParams(extraParams);
                    const queryString = params.toString();
                    const url = `/api/${finalTableName}/${id}${queryString ? `?${queryString}` : ''}`;
                    const res = await fetch(url, {
                        method: 'DELETE'
                    });
                    if (!res.ok) throw new Error(await res.text());
                    return res.json();
                }
            };
        }
    })
};
