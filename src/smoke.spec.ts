import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const Hello = defineComponent({ props: { name: { type: String, required: true } }, render() { return h('p', `Hola ${this.name}`) } })

describe('test infra smoke', () => {
  it('mounts a component in jsdom', () => {
    const wrapper = mount(Hello, { props: { name: 'Go Eats' } })
    expect(wrapper.text()).toBe('Hola Go Eats')
    expect(document.createElement('div').nodeName).toBe('DIV')
  })
})
