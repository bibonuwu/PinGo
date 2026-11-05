// Казахский словарь: русский текст из кода → перевод. Разбит по разделам приложения.
import admin from './admin';
import auth from './auth';
import common from './common';
import parent from './parent';
import shared from './shared';
import specialist from './specialist';

export default { ...common, ...auth, ...parent, ...specialist, ...shared, ...admin };
