'use strict';

const { describe, it } = require('node:test');
const vm = require('node:vm');
const { expect } = require('./expect');

describe('expect().toEqual', () => {
    it('matches arrays and objects built in a load() vm context against literals', () => {
        const fromVm = vm.runInNewContext('[1, [2, 3], { a: [4] }]');
        expect(fromVm).toEqual([1, [2, 3], { a: [4] }]);
        expect(fromVm).not.toEqual([1, [2, 3], { a: [5] }]);
    });

    it('still tells a class instance from a plain object', () => {
        class Point { constructor() { this.x = 1; } }
        expect(new Point()).not.toEqual({ x: 1 });
    });
});
