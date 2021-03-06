import * as angular from 'angular';
import { find, map, prop, UrlMatcher } from '../src/index';
import { UIRouter, UrlMatcherFactory, UrlService } from '@uirouter/core';
import './util/matchers';

declare var inject;

const module = angular['mock'].module;

describe('UrlMatcher', function () {
  let router: UIRouter;
  let $umf: UrlMatcherFactory;
  let $url: UrlService;

  beforeEach(inject(function($uiRouter, $urlMatcherFactory, $urlService) {
    router = $uiRouter;
    $umf = $urlMatcherFactory;
    $url = $urlService;
  }));

  describe('provider', function () {

    it('should factory matchers with correct configuration', function () {
      $umf.caseInsensitive(false);
      expect($umf.compile('/hello').exec('/HELLO')).toBeNull();

      $umf.caseInsensitive(true);
      expect($umf.compile('/hello').exec('/HELLO')).toEqual({});

      $umf.strictMode(true);
      expect($umf.compile('/hello').exec('/hello/')).toBeNull();

      $umf.strictMode(false);
      expect($umf.compile('/hello').exec('/hello/')).toEqual({});
    });

    it('should correctly validate UrlMatcher interface', function () {
      let m = $umf.compile('/');
      expect($umf.isMatcher(m)).toBe(true);

      m = angular.extend({}, m, { validates: null });
      expect($umf.isMatcher(m)).toBe(false);
    });
  });

  it('should match static URLs', function () {
    expect($umf.compile('/hello/world').exec('/hello/world')).toEqual({});
  });

  it('should match static case insensitive URLs', function () {
    expect($umf.compile('/hello/world', { caseInsensitive: true }).exec('/heLLo/World')).toEqual({});
  });

  it('should match against the entire path', function () {
    const matcher = $umf.compile('/hello/world', { strict: true });
    expect(matcher.exec('/hello/world/')).toBeNull();
    expect(matcher.exec('/hello/world/suffix')).toBeNull();
  });

  it('should parse parameter placeholders', function () {
    const matcher = $umf.compile('/users/:id/details/{type}/{repeat:[0-9]+}?from&to');
    expect(matcher.parameters().map(prop('id'))).toEqual(['id', 'type', 'repeat', 'from', 'to']);
  });

  it('should encode and decode duplicate query string values as array', function () {
    const matcher = $umf.compile('/?foo'), array = { foo: ['bar', 'baz'] };
    expect(matcher.exec('/', array)).toEqual(array);
    expect(matcher.format(array)).toBe('/?foo=bar&foo=baz');
  });

  it('should encode and decode slashes in parameter values as ~2F', function () {
    const matcher1 = $umf.compile('/:foo');

    expect(matcher1.format({ foo: '/' })).toBe('/~2F');
    expect(matcher1.format({ foo: '//' })).toBe('/~2F~2F');

    expect(matcher1.exec('/')).toBeTruthy();
    expect(matcher1.exec('//')).not.toBeTruthy();

    expect(matcher1.exec('/').foo).toBe('');
    expect(matcher1.exec('/123').foo).toBe('123');
    expect(matcher1.exec('/~2F').foo).toBe('/');
    expect(matcher1.exec('/123~2F').foo).toBe('123/');

    // param :foo should match between two slashes
    const matcher2 = $umf.compile('/:foo/');

    expect(matcher2.exec('/')).not.toBeTruthy();
    expect(matcher2.exec('//')).toBeTruthy();

    expect(matcher2.exec('//').foo).toBe('');
    expect(matcher2.exec('/123/').foo).toBe('123');
    expect(matcher2.exec('/~2F/').foo).toBe('/');
    expect(matcher2.exec('/123~2F/').foo).toBe('123/');
  });

  it('should encode and decode tildes in parameter values as ~~', function () {
    const matcher1 = $umf.compile('/:foo');

    expect(matcher1.format({ foo: 'abc' })).toBe('/abc');
    expect(matcher1.format({ foo: '~abc' })).toBe('/~~abc');
    expect(matcher1.format({ foo: '~2F' })).toBe('/~~2F');

    expect(matcher1.exec('/abc').foo).toBe('abc');
    expect(matcher1.exec('/~~abc').foo).toBe('~abc');
    expect(matcher1.exec('/~~2F').foo).toBe('~2F');
  });

  describe('snake-case parameters', function() {
    it('should match if properly formatted', function() {
      const matcher = $umf.compile('/users/?from&to&snake-case&snake-case-triple');
      expect(matcher.parameters().map(prop('id'))).toEqual(['from', 'to', 'snake-case', 'snake-case-triple']);
    });

    it('should not match if invalid', function() {
      let err = "Invalid parameter name '-snake' in pattern '/users/?from&to&-snake'";
      expect(function() { $umf.compile('/users/?from&to&-snake'); }).toThrowError(err);

      err = "Invalid parameter name 'snake-' in pattern '/users/?from&to&snake-'";
      expect(function() { $umf.compile('/users/?from&to&snake-'); }).toThrowError(err);
    });
  });

  describe('parameters containing periods', function() {
    it('should match if properly formatted', function() {
      const matcher = $umf.compile('/users/?from&to&with.periods&with.periods.also');
      const params = matcher.parameters().map(function(p) { return p.id; });

      expect(params.sort()).toEqual(['from', 'to', 'with.periods', 'with.periods.also']);
    });

    it('should not match if invalid', function() {
      let err = new Error("Invalid parameter name '.periods' in pattern '/users/?from&to&.periods'");
      expect(function() { $umf.compile('/users/?from&to&.periods'); }).toThrow(err);

      err = new Error("Invalid parameter name 'periods.' in pattern '/users/?from&to&periods.'");
      expect(function() { $umf.compile('/users/?from&to&periods.'); }).toThrow(err);
    });
  });

  describe('.exec()', function() {
    it('should capture parameter values', function () {
      const m = $umf.compile('/users/:id/details/{type}/{repeat:[0-9]+}?from&to', { strict: false });
      expect(m.exec('/users/123/details//0', {})).toEqualData({ id: '123', type: '', repeat: '0' });
    });

    it('should capture catch-all parameters', function () {
      const m = $umf.compile('/document/*path');
      expect(m.exec('/document/a/b/c', {})).toEqual({ path: 'a/b/c' });
      expect(m.exec('/document/', {})).toEqual({ path: '' });
    });

    it('should use the optional regexp with curly brace placeholders', function () {
      const m = $umf.compile('/users/:id/details/{type}/{repeat:[0-9]+}?from&to');
      expect(m.exec('/users/123/details/what/thisShouldBeDigits', {})).toBeNull();
    });

    it("should not use optional regexp for '/'", function () {
      const m = $umf.compile('/{language:(?:fr|en|de)}');
      expect(m.exec('/', {})).toBeNull();
    });

    it('should work with empty default value', function () {
      const m = $umf.compile('/foo/:str', { params: { str: { value: '' } } });
      expect(m.exec('/foo/', {})).toEqual({ str: '' });
    });

    it('should work with empty default value for regex', function () {
      const m = $umf.compile('/foo/{param:(?:foo|bar|)}', { params: { param: { value: '' } } });
      expect(m.exec('/foo/', {})).toEqual({ param: '' });
    });

    it('should treat the URL as already decoded and does not decode it further', function () {
      expect($umf.compile('/users/:id').exec('/users/100%25', {})).toEqual({ id: '100%25' });
    });

    xit('should allow embedded capture groups', function () {
      const shouldPass = {
        '/url/{matchedParam:([a-z]+)}/child/{childParam}': '/url/someword/child/childParam',
        '/url/{matchedParam:([a-z]+)}/child/{childParam}?foo': '/url/someword/child/childParam',
      };

      angular.forEach(shouldPass, function(url, route) {
        expect($umf.compile(route).exec(url, {})).toEqual({
          childParam: 'childParam',
          matchedParam: 'someword',
        });
      });
    });

    it('should throw on unbalanced capture list', function () {
      const shouldThrow = {
        '/url/{matchedParam:([a-z]+)}/child/{childParam}': '/url/someword/child/childParam',
        '/url/{matchedParam:([a-z]+)}/child/{childParam}?foo': '/url/someword/child/childParam',
      };

      angular.forEach(shouldThrow, function(url, route) {
        expect(function() { $umf.compile(route).exec(url, {}); }).toThrowError(
          "Unbalanced capture group in route '" + route + "'",
        );
      });

      const shouldPass = {
        '/url/{matchedParam:[a-z]+}/child/{childParam}': '/url/someword/child/childParam',
        '/url/{matchedParam:[a-z]+}/child/{childParam}?foo': '/url/someword/child/childParam',
      };

      angular.forEach(shouldPass, function(url, route) {
        expect(function() { $umf.compile(route).exec(url, {}); }).not.toThrow();
      });
    });
  });

  describe('.format()', function() {
    it('should reconstitute the URL', function () {
      const m = $umf.compile('/users/:id/details/{type}/{repeat:[0-9]+}?from'),
          params = { id: '123', type: 'default', repeat: 444, ignored: 'value', from: '1970' };

      expect(m.format(params)).toEqual('/users/123/details/default/444?from=1970');
    });

    it('should encode URL parameters', function () {
      expect($umf.compile('/users/:id').format({ id: '100%' })).toEqual('/users/100%25');
    });

    it('encodes URL parameters with hashes', function () {
      const m = $umf.compile('/users/:id#:section');
      expect(m.format({ id: 'bob', section: 'contact-details' })).toEqual('/users/bob#contact-details');
    });

    it('should trim trailing slashes when the terminal value is optional', function () {
      const config = { params: { id: { squash: true, value: '123' } } },
          m = $umf.compile('/users/:id', config),
          params = { id: '123' };

      expect(m.format(params)).toEqual('/users');
    });

    it('should format query parameters from parent, child, grandchild matchers', function() {
      const m = $umf.compile('/parent?qParent');
      const m2 = m.append($umf.compile('/child?qChild'));
      const m3 = m2.append($umf.compile('/grandchild?qGrandchild'));

      const params = { qParent: 'parent', qChild: 'child', qGrandchild: 'grandchild' };
      const url = '/parent/child/grandchild?qParent=parent&qChild=child&qGrandchild=grandchild';

      const formatted = m3.format(params);
      expect(formatted).toBe(url);
      expect(m3.exec(url.split('?')[0], params)).toEqualData(params);
    });
  });

  describe('.append()', function() {
    it('should append matchers', function () {
      const matcher = $umf.compile('/users/:id/details/{type}?from').append($umf.compile('/{repeat:[0-9]+}?to'));
      const params = matcher.parameters();
      expect(params.map(prop('id'))).toEqual(['id', 'type', 'from', 'repeat', 'to']);
    });

    it('should return a new matcher', function () {
      const base = $umf.compile('/users/:id/details/{type}?from');
      const matcher = base.append($umf.compile('/{repeat:[0-9]+}?to'));
      expect(matcher).not.toBe(base);
    });

    it('should respect $urlMatcherFactoryProvider.strictMode', function() {
      let m = $umf.compile('/');
      $umf.strictMode(false);
      m = m.append($umf.compile('foo'));
      expect(m.exec('/foo')).toEqual({});
      expect(m.exec('/foo/')).toEqual({});
    });

    it('should respect $urlMatcherFactoryProvider.caseInsensitive', function() {
      let m = $umf.compile('/');
      $umf.caseInsensitive(true);
      m = m.append($umf.compile('foo'));
      expect(m.exec('/foo')).toEqual({});
      expect(m.exec('/FOO')).toEqual({});
    });

    it('should respect $urlMatcherFactoryProvider.caseInsensitive when validating regex params', function() {
      let m = $umf.compile('/');
      $umf.caseInsensitive(true);
      m = m.append($umf.compile('foo/{param:bar}'));
      expect(m.validates({ param: 'BAR' })).toEqual(true);
    });

    it('should generate/match params in the proper order', function() {
      let m = $umf.compile('/foo?queryparam');
      m = m.append($umf.compile('/bar/:pathparam'));
      expect(m.exec('/foo/bar/pathval', { queryparam: 'queryval' })).toEqual({
        pathparam: 'pathval',
        queryparam: 'queryval',
      });
    });
  });


  describe('multivalue-query-parameters', function() {
    it('should handle .is() for an array of values', (function() {
      const m = $umf.compile('/foo?{param1:int}'), param = m.parameter('param1');
      expect(param.type.is([1, 2, 3])).toBe(true);
      expect(param.type.is([1, '2', 3])).toBe(false);
    }));

    it('should handle .equals() for two arrays of values', (function() {
      const m = $umf.compile('/foo?{param1:int}&{param2:date}'),
          param1 = m.parameter('param1'),
          param2 = m.parameter('param2');

      expect(param1.type.equals([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(param1.type.equals([1, 2, 3], [1, 2 ])).toBe(false);
      expect(param2.type.equals(
        [new Date(2014, 11, 15), new Date(2014, 10, 15)],
        [new Date(2014, 11, 15), new Date(2014, 10, 15)]),
      ).toBe(true);
      expect(param2.type.equals(
        [new Date(2014, 11, 15), new Date(2014, 9, 15)],
        [new Date(2014, 11, 15), new Date(2014, 10, 15)]),
      ).toBe(false);
    }));

    it('should conditionally be wrapped in an array by default', (function() {
      const m = $umf.compile('/foo?param1');

      // empty array [] is treated like "undefined"
      expect(m.format({ param1: undefined })).toBe('/foo');
      expect(m.format({ param1: [] })).toBe('/foo');
      expect(m.format({ param1: '' })).toBe('/foo');
      expect(m.format({ param1: '1' })).toBe('/foo?param1=1');
      expect(m.format({ param1: [ '1' ] })).toBe('/foo?param1=1');
      expect(m.format({ param1: [ '1', '2' ] })).toBe('/foo?param1=1&param1=2');

      expect(m.exec('/foo')).toEqual({ param1: undefined });
      expect(m.exec('/foo', {})).toEqual({ param1: undefined });
      expect(m.exec('/foo', { param1: '' })).toEqual({ param1: undefined });
      expect(m.exec('/foo', { param1: '1' })).toEqual({ param1: '1' }); // auto unwrap single values
      expect(m.exec('/foo', { param1: ['1', '2'] })).toEqual({ param1: ['1', '2'] });

      $url.url('/foo');
      expect(m.exec($url.path(), $url.search())).toEqual( { param1: undefined } );
      $url.url('/foo?param1=bar');
      expect(m.exec($url.path(), $url.search())).toEqual( { param1: 'bar' } ); // auto unwrap
      $url.url('/foo?param1=');
      expect(m.exec($url.path(), $url.search())).toEqual( { param1: undefined } );
      $url.url('/foo?param1=bar&param1=baz');
      if (angular.isArray($url.search())) // conditional for angular 1.0.8
        expect(m.exec($url.path(), $url.search())).toEqual( { param1: ['bar', 'baz'] } );

      expect(m.format({ })).toBe('/foo');
      expect(m.format({ param1: undefined })).toBe('/foo');
      expect(m.format({ param1: '' })).toBe('/foo');
      expect(m.format({ param1: 'bar' })).toBe('/foo?param1=bar');
      expect(m.format({ param1: [ 'bar' ] })).toBe('/foo?param1=bar');
      expect(m.format({ param1: ['bar', 'baz'] })).toBe('/foo?param1=bar&param1=baz');

    }));

    it('should be wrapped in an array if array: true', (function() {
      const m = $umf.compile('/foo?param1', { params: { param1: { array: true } } });

      // empty array [] is treated like "undefined"
      expect(m.format({ param1: undefined })).toBe('/foo');
      expect(m.format({ param1: [] })).toBe('/foo');
      expect(m.format({ param1: '' })).toBe('/foo');
      expect(m.format({ param1: '1' })).toBe('/foo?param1=1');
      expect(m.format({ param1: [ '1' ] })).toBe('/foo?param1=1');
      expect(m.format({ param1: [ '1', '2' ] })).toBe('/foo?param1=1&param1=2');

      expect(m.exec('/foo')).toEqual({ param1: undefined });
      expect(m.exec('/foo', {})).toEqual({ param1: undefined });
      expect(m.exec('/foo', { param1: '' })).toEqual({ param1: undefined });
      expect(m.exec('/foo', { param1: '1' })).toEqual({ param1: [ '1' ] });
      expect(m.exec('/foo', { param1: [ '1', '2' ] })).toEqual({ param1: [ '1', '2' ] });

      $url.url('/foo');
      expect(m.exec($url.path(), $url.search())).toEqual( { param1: undefined } );
      $url.url('/foo?param1=');
      expect(m.exec($url.path(), $url.search())).toEqual( { param1: undefined } );
      $url.url('/foo?param1=bar');
      expect(m.exec($url.path(), $url.search())).toEqual( { param1: [ 'bar' ] } );
      $url.url('/foo?param1=bar&param1=baz');
      if (angular.isArray($url.search())) // conditional for angular 1.0.8
        expect(m.exec($url.path(), $url.search())).toEqual( { param1: ['bar', 'baz'] } );

      expect(m.format({ })).toBe('/foo');
      expect(m.format({ param1: undefined })).toBe('/foo');
      expect(m.format({ param1: '' })).toBe('/foo');
      expect(m.format({ param1: 'bar' })).toBe('/foo?param1=bar');
      expect(m.format({ param1: [ 'bar' ] })).toBe('/foo?param1=bar');
      expect(m.format({ param1: ['bar', 'baz'] })).toBe('/foo?param1=bar&param1=baz');
    }));

    it('should be wrapped in an array if paramname looks like param[]', (function() {
      const m = $umf.compile('/foo?param1[]');

      expect(m.exec('/foo')).toEqualData({});

      $url.url('/foo?param1[]=bar');
      expect(m.exec($url.path(), $url.search())).toEqual( { 'param1[]': [ 'bar' ] } );
      expect(m.format({ 'param1[]': 'bar' })).toBe('/foo?param1[]=bar');
      expect(m.format({ 'param1[]': [ 'bar' ] })).toBe('/foo?param1[]=bar');

      $url.url('/foo?param1[]=bar&param1[]=baz');
      if (angular.isArray($url.search())) // conditional for angular 1.0.8
        expect(m.exec($url.path(), $url.search())).toEqual( { 'param1[]': ['bar', 'baz'] } );
      expect(m.format({ 'param1[]': ['bar', 'baz'] })).toBe('/foo?param1[]=bar&param1[]=baz');
    }));

    // Test for issue #2222
    it('should return default value, if query param is missing.', (function() {
      const m = $umf.compile('/state?param1&param2&param3&param5', {
        params: {
          param1 : 'value1',
          param2 : { array: true, value: ['value2'] },
          param3 : { array: true, value: [] },
          param5 : { array: true, value: function() {return []; } },
        },
      });

      const expected = {
        'param1': 'value1',
        'param2': ['value2'],
        'param3': [],
        'param5': [],
      };

      // Parse url to get Param.value()
      const parsed = m.exec('/state');
      expect(parsed).toEqualData(expected);

      // Pass again through Param.value() for normalization (like transitionTo)
      const paramDefs = m.parameters();
      const values = map(parsed, function(val, key) {
        return find(paramDefs, function(def) { return def.id === key; }).value(val);
      });
      expect(values).toEqualData(expected);
    }));

    it('should not be wrapped by ui-router into an array if array: false', (function() {
      const m = $umf.compile('/foo?param1', { params: { param1: { array: false } } });

      expect(m.exec('/foo')).toEqualData({});

      $url.url('/foo?param1=bar');
      expect(m.exec($url.path(), $url.search())).toEqual( { param1: 'bar' } );
      expect(m.format({ param1: 'bar' })).toBe('/foo?param1=bar');
      expect(m.format({ param1: [ 'bar' ] })).toBe('/foo?param1=bar');

      $url.url('/foo?param1=bar&param1=baz');
      if (angular.isArray($url.search())) // conditional for angular 1.0.8
        expect(m.exec($url.path(), $url.search())).toEqual( { param1: 'bar,baz' } ); // coerced to string
      expect(m.format({ param1: ['bar', 'baz'] })).toBe('/foo?param1=bar%2Cbaz'); // coerced to string
    }));
  });

  describe('multivalue-path-parameters', function() {
    it('should behave as a single-value by default', (function() {
      const m = $umf.compile('/foo/:param1');

      expect(m.exec('/foo/')).toEqual({ param1: '' });

      expect(m.exec('/foo/bar')).toEqual( { param1: 'bar' } );
      expect(m.format({ param1: 'bar' })).toBe('/foo/bar');
      expect(m.format({ param1: ['bar', 'baz'] })).toBe('/foo/bar%2Cbaz'); // coerced to string
    }));

    it('should be split on - in url and wrapped in an array if array: true', inject(function($location) {
      const m = $umf.compile('/foo/:param1', { params: { param1: { array: true } } });

      expect(m.exec('/foo/')).toEqual({ param1: undefined });
      expect(m.exec('/foo/bar')).toEqual({ param1: [ 'bar' ] });
      $url.url('/foo/bar-baz');
      expect(m.exec($location.url())).toEqual({ param1: [ 'bar', 'baz' ] });

      expect(m.format({ param1: [] })).toEqual('/foo/');
      expect(m.format({ param1: [ 'bar' ] })).toEqual('/foo/bar');
      expect(m.format({ param1: [ 'bar', 'baz' ] })).toEqual('/foo/bar-baz');
    }));

    it('should behave similar to multi-value query params', (function() {
      const m = $umf.compile('/foo/:param1[]');

      // empty array [] is treated like "undefined"
      expect(m.format({ 'param1[]': undefined })).toBe('/foo/');
      expect(m.format({ 'param1[]': [] })).toBe('/foo/');
      expect(m.format({ 'param1[]': '' })).toBe('/foo/');
      expect(m.format({ 'param1[]': '1' })).toBe('/foo/1');
      expect(m.format({ 'param1[]': [ '1' ] })).toBe('/foo/1');
      expect(m.format({ 'param1[]': [ '1', '2' ] })).toBe('/foo/1-2');

      expect(m.exec('/foo/')).toEqual({ 'param1[]': undefined });
      expect(m.exec('/foo/1')).toEqual({ 'param1[]': [ '1' ] });
      expect(m.exec('/foo/1-2')).toEqual({ 'param1[]': [ '1', '2' ] });

      $url.url('/foo/');
      expect(m.exec($url.path(), $url.search())).toEqual( { 'param1[]': undefined } );
      $url.url('/foo/bar');
      expect(m.exec($url.path(), $url.search())).toEqual( { 'param1[]': [ 'bar' ] } );
      $url.url('/foo/bar-baz');
      expect(m.exec($url.path(), $url.search())).toEqual( { 'param1[]': ['bar', 'baz'] } );

      expect(m.format({ })).toBe('/foo/');
      expect(m.format({ 'param1[]': undefined })).toBe('/foo/');
      expect(m.format({ 'param1[]': '' })).toBe('/foo/');
      expect(m.format({ 'param1[]': 'bar' })).toBe('/foo/bar');
      expect(m.format({ 'param1[]': [ 'bar' ] })).toBe('/foo/bar');
      expect(m.format({ 'param1[]': ['bar', 'baz'] })).toBe('/foo/bar-baz');
    }));

    it('should be split on - in url and wrapped in an array if paramname looks like param[]', (function() {
      const m = $umf.compile('/foo/:param1[]');

      expect(m.exec('/foo/')).toEqual({ 'param1[]': undefined });
      expect(m.exec('/foo/bar')).toEqual({ 'param1[]': [ 'bar' ] });
      expect(m.exec('/foo/bar-baz')).toEqual({ 'param1[]': [ 'bar', 'baz' ] });

      expect(m.format({ 'param1[]': [] })).toEqual('/foo/');
      expect(m.format({ 'param1[]': [ 'bar' ] })).toEqual('/foo/bar');
      expect(m.format({ 'param1[]': [ 'bar', 'baz' ] })).toEqual('/foo/bar-baz');
    }));

    it("should allow path param arrays with '-' in the values", (function() {
      const m = $umf.compile('/foo/:param1[]');

      expect(m.exec('/foo/')).toEqual({ 'param1[]': undefined });
      expect(m.exec('/foo/bar\\-')).toEqual({ 'param1[]': [ 'bar-' ] });
      expect(m.exec('/foo/bar\\--\\-baz')).toEqual({ 'param1[]': [ 'bar-', '-baz' ] });

      expect(m.format({ 'param1[]': [] })).toEqual('/foo/');
      expect(m.format({ 'param1[]': [ 'bar-' ] })).toEqual('/foo/bar%5C%2D');
      expect(m.format({ 'param1[]': [ 'bar-', '-baz' ] })).toEqual('/foo/bar%5C%2D-%5C%2Dbaz');
      expect(m.format({ 'param1[]': [ 'bar-bar-bar-', '-baz-baz-baz' ] }))
        .toEqual('/foo/bar%5C%2Dbar%5C%2Dbar%5C%2D-%5C%2Dbaz%5C%2Dbaz%5C%2Dbaz');

      // check that we handle $location.url decodes correctly
      $url.url(m.format({ 'param1[]': [ 'bar-', '-baz' ] }));
      expect(m.exec($url.path(), $url.search())).toEqual({ 'param1[]': [ 'bar-', '-baz' ] });

      // check that we handle $location.url decodes correctly for multiple hyphens
      $url.url(m.format({ 'param1[]': [ 'bar-bar-bar-', '-baz-baz-baz' ] }));
      expect(m.exec($url.path(), $url.search())).toEqual({ 'param1[]': [ 'bar-bar-bar-', '-baz-baz-baz' ] });

      // check that pre-encoded values are passed correctly
      $url.url(m.format({ 'param1[]': [ '%2C%20%5C%2C', '-baz' ] }));
      expect(m.exec($url.path(), $url.search())).toEqual({ 'param1[]': [ '%2C%20%5C%2C', '-baz' ] });

    }));
  });
});

describe('urlMatcherFactoryProvider', function () {
  describe('.type()', function () {
    let $umf;
    beforeEach(module('ui.router.util', function($urlMatcherFactoryProvider) {
      $umf = $urlMatcherFactoryProvider;
      $urlMatcherFactoryProvider.type('myType', {}, function() {
          return {
            decode: function() { return { status: 'decoded' }; },
            is: angular.isObject,
          };
      });
    }));

    it('should handle arrays properly with config-time custom type definitions', inject(function ($stateParams) {
      const m = $umf.compile('/test?{foo:myType}');
      expect(m.exec('/test', { foo: '1' })).toEqual({ foo: { status: 'decoded' } });
      expect(m.exec('/test', { foo: ['1', '2'] })).toEqual({ foo: [ { status: 'decoded' }, { status: 'decoded' }] });
    }));
  });

  // TODO: Fix object pollution between tests for urlMatcherConfig
  afterEach(inject(function($urlMatcherFactory) {
    $urlMatcherFactory.caseInsensitive(false);
  }));
});

describe('urlMatcherFactory', function () {
  let $umf: UrlMatcherFactory;
  let $url: UrlService;

  beforeEach(inject(function($urlMatcherFactory, $urlService) {
    $umf = $urlMatcherFactory;
    $url = $urlService;
  }));

  it('compiles patterns', function () {
    const matcher = $umf.compile('/hello/world');
    expect(matcher instanceof UrlMatcher).toBe(true);
  });

  it('recognizes matchers', function () {
    expect($umf.isMatcher($umf.compile('/'))).toBe(true);

    const custom = {
      format:     angular.noop,
      exec:       angular.noop,
      append:     angular.noop,
      isRoot:     angular.noop,
      validates:  angular.noop,
      parameters: angular.noop,
      parameter:  angular.noop,
    };
    expect($umf.isMatcher(custom)).toBe(true);
  });

  it('should handle case sensitive URL by default', function () {
    expect($umf.compile('/hello/world').exec('/heLLo/WORLD')).toBeNull();
  });

  it('should handle case insensitive URL', function () {
    $umf.caseInsensitive(true);
    expect($umf.compile('/hello/world').exec('/heLLo/WORLD')).toEqual({});
  });

  describe('typed parameters', function() {
    it('should accept object definitions', function () {
      const type = { encode: function() {}, decode: function() {} } as any;
      $umf.type('myType1', type);
      expect($umf.type('myType1').encode).toBe(type.encode);
    });

    it('should reject duplicate definitions', function () {
      $umf.type('myType2', { encode: function () {}, decode: function () {} } as any);
      expect(function() { $umf.type('myType2', {} as any); }).toThrowError("A type named 'myType2' has already been defined.");
    });

    it('should accept injected function definitions', inject(function ($stateParams) {
      $umf.type('myType3', {} as any, function($stateParams) {
        return {
          decode: function() {
            return $stateParams;
          },
        };
      } as any);
      expect($umf.type('myType3').decode()).toBe($stateParams);
    }));

    it('should accept annotated function definitions', inject(function ($stateParams) {
      $umf.type('myAnnotatedType', {} as any, ['$stateParams', function(s) {
        return {
          decode: function() {
            return s;
          },
        };
      }] as any);
      expect($umf.type('myAnnotatedType').decode()).toBe($stateParams);
    }));

    it('should match built-in types', function () {
      const m = $umf.compile('/{foo:int}/{flag:bool}');
      expect(m.exec('/1138/1')).toEqual({ foo: 1138, flag: true });
      expect(m.format({ foo: 5, flag: true })).toBe('/5/1');

      expect(m.exec('/-1138/1')).toEqual({ foo: -1138, flag: true });
      expect(m.format({ foo: -5, flag: true })).toBe('/-5/1');
    });

    it('should match built-in types with spaces', function () {
      const m = $umf.compile('/{foo: int}/{flag:  bool}');
      expect(m.exec('/1138/1')).toEqual({ foo: 1138, flag: true });
      expect(m.format({ foo: 5, flag: true })).toBe('/5/1');
    });

    it('should match types named only in params', function () {
      const m = $umf.compile('/{foo}/{flag}', {
        params: {
          foo: { type: 'int' },
          flag: { type: 'bool' },
        },
      });
      expect(m.exec('/1138/1')).toEqual({ foo: 1138, flag: true });
      expect(m.format({ foo: 5, flag: true })).toBe('/5/1');
    });

    it('should throw an error if a param type is declared twice', function () {
      expect(function() {
        $umf.compile('/{foo:int}', {
          params: {
            foo: { type: 'int' },
          },
        });
      }).toThrow(new Error("Param 'foo' has two type configurations."));
    });

    it('should encode/decode dates', function () {
      const m = $umf.compile('/calendar/{date:date}'),
          result = m.exec('/calendar/2014-03-26');
      const date = new Date(2014, 2, 26);

      expect(result.date instanceof Date).toBe(true);
      expect(result.date.toUTCString()).toEqual(date.toUTCString());
      expect(m.format({ date: date })).toBe('/calendar/2014-03-26');
    });

    it('should encode/decode arbitrary objects to json', function () {
      const m = $umf.compile('/state/{param1:json}/{param2:json}');

      const params = {
        param1: { foo: 'huh', count: 3 },
        param2: { foo: 'wha', count: 5 },
      };

      const json1 = '{"foo":"huh","count":3}';
      const json2 = '{"foo":"wha","count":5}';

      expect(m.format(params)).toBe('/state/' + encodeURIComponent(json1) + '/' + encodeURIComponent(json2));
      expect(m.exec('/state/' + json1 + '/' + json2)).toEqual(params);
    });

    it('should not match invalid typed parameter values', function() {
      const m = $umf.compile('/users/{id:int}');

      expect(m.exec('/users/1138').id).toBe(1138);
      expect(m.exec('/users/alpha')).toBeNull();

      expect(m.format({ id: 1138 })).toBe('/users/1138');
      expect(m.format({ id: 'alpha' })).toBeNull();
    });

    it('should automatically handle multiple search param values', (function() {
      const m = $umf.compile('/foo/{fooid:int}?{bar:int}');

      $url.url('/foo/5?bar=1');
      expect(m.exec($url.path(), $url.search())).toEqual( { fooid: 5, bar: 1 } );
      expect(m.format({ fooid: 5, bar: 1 })).toEqual('/foo/5?bar=1');

      $url.url('/foo/5?bar=1&bar=2&bar=3');
      if (angular.isArray($url.search())) // conditional for angular 1.0.8
        expect(m.exec($url.path(), $url.search())).toEqual( { fooid: 5, bar: [ 1, 2, 3 ] } );
      expect(m.format({ fooid: 5, bar: [ 1, 2, 3 ] })).toEqual('/foo/5?bar=1&bar=2&bar=3');

      m.format();
    }));

    it('should allow custom types to handle multiple search param values manually', (function() {
      $umf.type('custArray', {
        encode: function(array)  { return array.join('-'); },
        decode: function(val) { return angular.isArray(val) ? val : val.split(/-/); },
        equals: angular.equals,
        is: angular.isArray,
      });

      const m = $umf.compile('/foo?{bar:custArray}', { params: { bar: { array: false } } } );

      $url.url('/foo?bar=fox');
      expect(m.exec($url.path(), $url.search())).toEqual( { bar: [ 'fox' ] } );
      expect(m.format({ bar: [ 'fox' ] })).toEqual('/foo?bar=fox');

      $url.url('/foo?bar=quick-brown-fox');
      expect(m.exec($url.path(), $url.search())).toEqual( { bar: [ 'quick', 'brown', 'fox' ] } );
      expect(m.format({ bar: [ 'quick', 'brown', 'fox' ] })).toEqual('/foo?bar=quick-brown-fox');
    }));
  });

  describe('optional parameters', function() {
    it('should match with or without values', function () {
      const m = $umf.compile('/users/{id:int}', {
        params: { id: { value: null, squash: true } },
      });
      expect(m.exec('/users/1138')).toEqual({ id: 1138 });
      expect(m.exec('/users1138')).toBeNull();
      expect(m.exec('/users/').id).toBeNull();
      expect(m.exec('/users').id).toBeNull();
    });

    it('should correctly match multiple', function() {
      const m = $umf.compile('/users/{id:int}/{state:[A-Z]+}', {
        params: { id: { value: null, squash: true }, state: { value: null, squash: true } },
      });
      expect(m.exec('/users/1138')).toEqual({ id: 1138, state: null });
      expect(m.exec('/users/1138/NY')).toEqual({ id: 1138, state: 'NY' });

      expect(m.exec('/users/').id).toBeNull();
      expect(m.exec('/users/').state).toBeNull();

      expect(m.exec('/users').id).toBeNull();
      expect(m.exec('/users').state).toBeNull();

      expect(m.exec('/users/NY').state).toBe('NY');
      expect(m.exec('/users/NY').id).toBeNull();
    });

    it('should correctly format with or without values', function() {
      const m = $umf.compile('/users/{id:int}', {
        params: { id: { value: null } },
      });
      expect(m.format()).toBe('/users/');
      expect(m.format({ id: 1138 })).toBe('/users/1138');
    });

    it('should correctly format multiple', function() {
      const m = $umf.compile('/users/{id:int}/{state:[A-Z]+}', {
        params: { id: { value: null, squash: true }, state: { value: null, squash: true } },
      });

      expect(m.format()).toBe('/users');
      expect(m.format({ id: 1138 })).toBe('/users/1138');
      expect(m.format({ state: 'NY' })).toBe('/users/NY');
      expect(m.format({ id: 1138, state: 'NY' })).toBe('/users/1138/NY');
    });

    it('should match in between static segments', function() {
      const m = $umf.compile('/users/{user:int}/photos', {
        params: { user: { value: 5, squash: true } },
      });
      expect(m.exec('/users/photos').user).toBe(5);
      expect(m.exec('/users/6/photos').user).toBe(6);
      expect(m.format()).toBe('/users/photos');
      expect(m.format({ user: 1138 })).toBe('/users/1138/photos');
    });

    it('should correctly format with an optional followed by a required parameter', function() {
      const m = $umf.compile('/home/:user/gallery/photos/:photo', {
        params: {
          user: { value: null, squash: true },
          photo: undefined,
        },
      });
      expect(m.format({ photo: 12 })).toBe('/home/gallery/photos/12');
      expect(m.format({ user: 1138, photo: 13 })).toBe('/home/1138/gallery/photos/13');
    });

    describe('default values', function() {
      it('should populate if not supplied in URL', function() {
        const m = $umf.compile('/users/{id:int}/{test}', {
          params: { id: { value: 0, squash: true }, test: { value: 'foo', squash: true } },
        });
        expect(m.exec('/users')).toEqual({ id: 0, test: 'foo' });
        expect(m.exec('/users/2')).toEqual({ id: 2, test: 'foo' });
        expect(m.exec('/users/bar')).toEqual({ id: 0, test: 'bar' });
        expect(m.exec('/users/2/bar')).toEqual({ id: 2, test: 'bar' });
        expect(m.exec('/users/bar/2')).toBeNull();
      });

      it('should populate even if the regexp requires 1 or more chars', function() {
        const m = $umf.compile('/record/{appId}/{recordId:[0-9a-fA-F]{10,24}}', {
          params: { appId: null, recordId: null },
        });
        expect(m.exec('/record/546a3e4dd273c60780e35df3/'))
          .toEqual({ appId: '546a3e4dd273c60780e35df3', recordId: null });
      });

      it('should allow shorthand definitions', function() {
        const m = $umf.compile('/foo/:foo', {
          params: { foo: 'bar' },
        });
        expect(m.exec('/foo/')).toEqual({ foo: 'bar' });
      });

      it('should populate query params', function() {
        const defaults = { order: 'name', limit: 25, page: 1 };
        const m = $umf.compile('/foo?order&{limit:int}&{page:int}', {
          params: defaults,
        });
        expect(m.exec('/foo')).toEqual(defaults);
      });

      it('should allow function-calculated values', function() {
        function barFn() { return 'Value from bar()'; }
        let m = $umf.compile('/foo/:bar', {
          params: { bar: barFn },
        });
        expect(m.exec('/foo/').bar).toBe('Value from bar()');

        m = $umf.compile('/foo/:bar', {
          params: { bar: { value: barFn, squash: true } },
        });
        expect(m.exec('/foo').bar).toBe('Value from bar()');

        m = $umf.compile('/foo?bar', {
          params: { bar: barFn },
        });
        expect(m.exec('/foo').bar).toBe('Value from bar()');
      });

      it('should allow injectable functions', inject(function($stateParams) {
        const m = $umf.compile('/users/{user:json}', {
          params: {
            user: function($stateParams) {
              return $stateParams.user;
            },
          },
        });
        const user = { name: 'Bob' };

        $stateParams.user = user;
        expect(m.exec('/users/').user).toBe(user);
      }));

      xit('should match when used as prefix', function() {
        const m = $umf.compile('/{lang:[a-z]{2}}/foo', {
          params: { lang: 'de' },
        });
        expect(m.exec('/de/foo')).toEqual({ lang: 'de' });
        expect(m.exec('/foo')).toEqual({ lang: 'de' });
      });

      describe('squash policy', function() {
        const Session = { username: 'loggedinuser' };
        function getMatcher(squash) {
          return $umf.compile('/user/:userid/gallery/:galleryid/photo/:photoid', {
            params: {
              userid: { squash: squash, value: function () { return Session.username; } },
              galleryid: { squash: squash, value: 'favorites' },
            },
          });
        }

        it(': true should squash the default value and one slash', inject(function($stateParams) {
          const m = getMatcher(true);

          const defaultParams = { userid: 'loggedinuser', galleryid: 'favorites', photoid: '123' };
          expect(m.exec('/user/gallery/photo/123')).toEqual(defaultParams);
          expect(m.exec('/user//gallery//photo/123')).toEqual(defaultParams);
          expect(m.format(defaultParams)).toBe('/user/gallery/photo/123');

          const nonDefaultParams = { userid: 'otheruser', galleryid: 'travel', photoid: '987' };
          expect(m.exec('/user/otheruser/gallery/travel/photo/987')).toEqual(nonDefaultParams);
          expect(m.format(nonDefaultParams)).toBe('/user/otheruser/gallery/travel/photo/987');
        }));

        it(': false should not squash default values', inject(function($stateParams) {
          const m = getMatcher(false);

          const defaultParams = { userid: 'loggedinuser', galleryid: 'favorites', photoid: '123' };
          expect(m.exec('/user/loggedinuser/gallery/favorites/photo/123')).toEqual(defaultParams);
          expect(m.format(defaultParams)).toBe('/user/loggedinuser/gallery/favorites/photo/123');

          const nonDefaultParams = { userid: 'otheruser', galleryid: 'travel', photoid: '987' };
          expect(m.exec('/user/otheruser/gallery/travel/photo/987')).toEqual(nonDefaultParams);
          expect(m.format(nonDefaultParams)).toBe('/user/otheruser/gallery/travel/photo/987');
        }));

        it(": '' should squash the default value to an empty string", inject(function($stateParams) {
          const m = getMatcher('');

          const defaultParams = { userid: 'loggedinuser', galleryid: 'favorites', photoid: '123' };
          expect(m.exec('/user//gallery//photo/123')).toEqual(defaultParams);
          expect(m.format(defaultParams)).toBe('/user//gallery//photo/123');

          const nonDefaultParams = { userid: 'otheruser', galleryid: 'travel', photoid: '987' };
          expect(m.exec('/user/otheruser/gallery/travel/photo/987')).toEqual(nonDefaultParams);
          expect(m.format(nonDefaultParams)).toBe('/user/otheruser/gallery/travel/photo/987');
        }));

        it(": '~' should squash the default value and replace it with '~'", inject(function($stateParams) {
          const m = getMatcher('~');

          const defaultParams = { userid: 'loggedinuser', galleryid: 'favorites', photoid: '123' };
          expect(m.exec('/user//gallery//photo/123')).toEqual(defaultParams);
          expect(m.exec('/user/~/gallery/~/photo/123')).toEqual(defaultParams);
          expect(m.format(defaultParams)).toBe('/user/~/gallery/~/photo/123');

          const nonDefaultParams = { userid: 'otheruser', galleryid: 'travel', photoid: '987' };
          expect(m.exec('/user/otheruser/gallery/travel/photo/987')).toEqual(nonDefaultParams);
          expect(m.format(nonDefaultParams)).toBe('/user/otheruser/gallery/travel/photo/987');
        }));
      });
    });
  });

  describe('strict matching', function() {
    it('should match with or without trailing slash', function() {
      const m = $umf.compile('/users', { strict: false });
      expect(m.exec('/users')).toEqual({});
      expect(m.exec('/users/')).toEqual({});
    });

    it('should not match multiple trailing slashes', function() {
      const m = $umf.compile('/users', { strict: false });
      expect(m.exec('/users//')).toBeNull();
    });

    it('should match when defined with parameters', function() {
      const m = $umf.compile('/users/{name}', { strict: false, params: {
        name: { value: null },
      }});
      expect(m.exec('/users/')).toEqual({ name: null });
      expect(m.exec('/users/bob')).toEqual({ name: 'bob' });
      expect(m.exec('/users/bob/')).toEqual({ name: 'bob' });
      expect(m.exec('/users/bob//')).toBeNull();
    });
  });
});
