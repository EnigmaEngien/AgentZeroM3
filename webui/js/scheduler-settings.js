// Pre-define schedulerSettings skeleton to ensure it's available to Alpine
globalThis.schedulerSettings = function () {
    return {
        tasks: [],
        isLoading: true,
        selectedTask: null,
        expandedTaskId: null,
        sortField: 'name',
        sortDirection: 'asc',
        filterType: 'all',
        filterState: 'all',
        pollingInterval: null,
        pollingActive: false,
        editingTask: {
            name: '',
            type: 'scheduled',
            state: 'idle',
            schedule: {
                minute: '*',
                hour: '*',
                day: '*',
                month: '*',
                weekday: '*',
                timezone: ''
            },
            token: '',
            plan: {
                todo: [],
                in_progress: null,
                done: []
            },
            system_prompt: '',
            prompt: '',
            attachments: []
        },
        isCreating: false,
        isEditing: false,
        showLoadingState: false,
        viewMode: 'list',
        selectedTaskForDetail: null,
        attachmentsText: '',
        filteredTasks: [],
        // Minimal init to avoid errors
        init() {
            console.log('Basic schedulerSettings initialized');
            // Watch for task type changes
            this.$watch('editingTask.type', (newType) => {
                if (newType === 'planned') {
                    // When switching to planned task type, initialize the datetime picker
                    this.$nextTick(() => {
                        if (this.initFlatpickr) {
                            if (this.isCreating) {
                                this.initFlatpickr('create');
                            } else if (this.isEditing) {
                                this.initFlatpickr('edit');
                            }
                        }
                    });
                }
            });
        }
    };
};
