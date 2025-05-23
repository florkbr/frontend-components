import { render } from '@testing-library/react';
import decorator from './decorator';

describe('TreeTable decorator', () => {
  it('should render correctly - no data', () => {
    const toRender = decorator()();
    expect(toRender).toMatchObject({ children: '', className: '' });
  });

  it('should render correctly - with data', () => {
    const { children, className } = decorator()('value', { rowData: { level: 0 } });
    expect(className).toBe('pf-v6-c-treeview__title-cell');
    const { container } = render(children);
    expect(container).toMatchSnapshot();
  });

  it('should render correctly - with data tree collapsed', () => {
    const { children, className } = decorator()('value', { rowData: { level: 0, isTreeOpen: false } });
    expect(className).toBe('pf-v6-c-treeview__title-cell');
    const { container } = render(children);
    expect(container).toMatchSnapshot();
  });

  it('should render correctly - with data tree opened', () => {
    const { children, className } = decorator()('value', { rowData: { level: 0, isTreeOpen: true } });
    expect(className).toBe('pf-v6-c-treeview__title-cell');
    const { container } = render(children);
    expect(container).toMatchSnapshot();
  });

  it('should not call function on click', () => {
    const callback = jest.fn();
    const { children } = decorator()('value', { rowData: { level: 0, isTreeOpen: true } });
    const { container } = render(children);
    container.querySelectorAll('button')[0].click();
    expect(callback).not.toHaveBeenCalled();
  });

  it('should not call function on click', () => {
    const callback = jest.fn();
    const { children } = decorator(callback)('value', { rowData: { level: 0, isTreeOpen: true } });
    const { container } = render(children);
    container.querySelectorAll('button')[0].click();
    expect(callback).toHaveBeenCalled();
  });
});
