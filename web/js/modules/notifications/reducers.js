import { requestReducer } from '../core/reducers';
import {
  getCount,
  separateByType,
  getPriority,
} from './util';
import {
  REQUEST_NOTIFICATIONS,
  SET_NOTIFICATIONS,
  NOTIFICATIONS_SEEN,
  OUTAGE_NOTIFICATIONS_SEEN,
} from './constants';

export const notificationReducerState = {
  number: null,
  numberUnseen: null,
  type: '',
  isActive: false,
  object: {},
};

export function notificationsRequest(state = {}, action) {
  return requestReducer(REQUEST_NOTIFICATIONS, state, action);
}

export function notificationsReducer(state = notificationReducerState, action) {
  switch (action.type) {
    case SET_NOTIFICATIONS:
      if (action.array.length > 0) {
        const notificationsByType = separateByType(action.array);

        const { layerNotices } = notificationsByType;
        const numberOutagesUnseen = layerNotices.filter((notice) => notice.notification_type === 'outage').length;
        return {
          ...state,
          number: getCount(notificationsByType),
          numberUnseen: getCount(notificationsByType, true),
          numberOutagesUnseen,
          type: getPriority(notificationsByType),
          isActive: true,
          object: notificationsByType,
        };
      }
      return state;

    case NOTIFICATIONS_SEEN:
      return {
        ...state,
        numberUnseen: null,
        type: '',
        isActive: true,
      };
    case OUTAGE_NOTIFICATIONS_SEEN:
      return {
        ...state,
        numberOutagesUnseen: 0,
      };
    default:
      return state;
  }
}
