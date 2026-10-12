// Feature flags from shared/app_config.json.
import appConfig from '../../shared/app_config.json';

/** The LLM assistant. False in this phase: nothing about it is rendered anywhere (see the comment on the result screen). */
export const ASSISTANT_ENABLED: boolean = appConfig.ASSISTANT_ENABLED;
