const router = module.exports = require('express').Router();


const { router: usersRouter } = require('./users');
const { router: temperaturesRouter } = require('./temperatures');
const { router: soilsRouter } = require('./soils');
const { router: blocksRouter } = require('./blocks');
const { router: sensorsRouter } = require('./sensors');
const { router: farmsRouter } = require('./farms');


router.use('/users', usersRouter);
router.use('/temperatures', temperaturesRouter);
router.use('/soils', soilsRouter);
router.use('/blocks', blocksRouter);
router.use('/sensors', sensorsRouter);
router.use('/farms', farmsRouter);
